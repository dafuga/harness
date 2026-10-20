import { readdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect } from 'vitest';
import { remoteCacheFixture, remoteImage, remoteImageHash } from './remote-cache-fixture';
import { RemoteHttpProjectAdapter } from '../src/adapters/remote-http-project-adapter/RemoteHttpProjectAdapter';
const selection = { projectId: 'p', branch: 'main', commit: null };
const entity = { projectId: 'p', entityId: 'entity', commit: 'a'.repeat(40) };
test('authorized JSON projections survive restart offline, isolated by principal and read-only', async () => {
	const f = await remoteCacheFixture();
	try {
		await f.adapter.snapshot(selection);
		await f.adapter.entity(entity);
		await f.adapter.source({ ...entity, path: 'src/a.ts' });
		await f.adapter.messages({ ...entity, threadId: 'thread' });
		await f.close();
		const restarted = new RemoteHttpProjectAdapter(f.options);
		const snapshot = await restarted.snapshot(selection);
		expect(snapshot.cache).toMatchObject({
			status: 'offline',
			readOnly: true,
			cachedAt: expect.any(String)
		});
		expect(snapshot.writable).toBe(false);
		expect((await restarted.entity(entity)).title).toBe('first');
		expect((await restarted.source({ ...entity, path: 'src/a.ts' })).text).toBe('first');
		expect((await restarted.messages({ ...entity, threadId: 'thread' }))[0].text).toBe('first');
		f.state.principal = 'bob';
		await expect(restarted.snapshot(selection)).rejects.toThrow();
	} finally {
		await f.cleanup();
	}
});
test('changed notes refresh JSON; revocation cannot resurrect offline data', async () => {
	const f = await remoteCacheFixture();
	try {
		await f.adapter.snapshot(selection);
		expect((await f.adapter.entity(entity)).title).toBe('first');
		f.state.notes = 'f'.repeat(40);
		f.state.text = 'updated';
		expect((await f.adapter.entity(entity)).title).toBe('updated');
		f.state.status = 500;
		await expect(f.adapter.entity(entity)).rejects.toThrow();
		f.state.status = 403;
		await expect(f.adapter.entity(entity)).rejects.toThrow();
		await f.close();
		await expect(f.adapter.entity(entity)).rejects.toThrow();
	} finally {
		await f.cleanup();
	}
});

test('corrupt cache cannot display, rebuilding preserves the durable outbox and latest notes', async () => {
	const f = await remoteCacheFixture();
	try {
		await writeFile(join(f.root, 'outbox.json'), 'durable draft');
		await f.adapter.snapshot(selection);
		await f.adapter.entity(entity);
		f.state.notes = 'f'.repeat(40);
		f.state.text = 'latest';
		await f.adapter.entity(entity);
		const files = await readdir(join(f.root, 'cache'));
		for (const file of files)
			if (file.startsWith('projection-')) await writeFile(join(f.root, 'cache', file), 'corrupt');
		await f.cache.clear();
		expect((await f.adapter.entity(entity)).title).toBe('latest');
		expect(await readFile(join(f.root, 'outbox.json'), 'utf8')).toBe('durable draft');
		await f.close();
		expect((await f.adapter.entity(entity)).title).toBe('latest');
		for (const file of await readdir(join(f.root, 'cache')))
			if (file.startsWith('projection-')) await writeFile(join(f.root, 'cache', file), 'corrupt');
		await expect(f.adapter.entity(entity)).rejects.toThrow();
	} finally {
		await f.cleanup();
	}
});
test('malformed online data and different live principal are rejected instead of using prior cache', async () => {
	const f = await remoteCacheFixture();
	try {
		await f.adapter.snapshot(selection);
		await f.adapter.entity(entity);
		f.state.malformed = true;
		await expect(f.adapter.entity(entity)).rejects.toThrow('Invalid hosted');
		f.state.malformed = false;
		f.state.actor = 'bob';
		await expect(f.adapter.entity(entity)).rejects.toThrow('principal');
		await f.close();
		await expect(f.adapter.entity(entity)).rejects.toThrow();
	} finally {
		await f.cleanup();
	}
});
test('history and cached reads publish offline status before returning and cannot send comments', async () => {
	const f = await remoteCacheFixture();
	try {
		const statuses: string[] = [];
		const adapter = new RemoteHttpProjectAdapter({
			...f.options,
			onCacheStatus: (status) => statuses.push(status.status)
		});
		await adapter.snapshot(selection);
		await adapter.history({ ...entity, page: 1, branch: 'main' });
		await f.close();
		expect((await adapter.history({ ...entity, page: 1, branch: 'main' })).entries[0].title).toBe(
			'first'
		);
		expect(statuses.at(-1)).toBe('offline');
		await expect(
			adapter.addComment({
				projectId: 'p',
				requestId: 'request',
				text: 'never queued',
				anchor: {} as never
			})
		).rejects.toThrow();
	} finally {
		await f.cleanup();
	}
});

test('real PNG bytes remain readable offline and changed requested hash is never substituted', async () => {
	const f = await remoteCacheFixture();
	try {
		const query = { ...entity, version: 'v001', sha256: remoteImageHash };
		await f.adapter.snapshot(selection);
		expect(await f.adapter.image(query)).toEqual(remoteImage);
		await f.close();
		expect(await f.adapter.image(query)).toEqual(remoteImage);
		await expect(f.adapter.image({ ...query, sha256: '0'.repeat(64) })).rejects.toThrow();
	} finally {
		await f.cleanup();
	}
});

test.each([401, 403, 'signed-out', 'actor-mismatch'] as const)(
	'denial %s clears protected views before read rejection',
	async (denial) => {
		const f = await remoteCacheFixture();
		try {
			const events: Array<{ projectId: string; status: string }> = [];
			const adapter = new RemoteHttpProjectAdapter({
				...f.options,
				onCacheStatus: (status) => events.push(status)
			});
			await adapter.snapshot(selection);
			if (typeof denial === 'number') f.state.status = denial;
			else f.state.actor = denial === 'signed-out' ? '' : 'another-principal';
			await expect(
				adapter.source({ ...entity, path: 'src/a.ts' }).catch((error) => {
					events.push({ projectId: 'caught', status: 'rejected' });
					throw error;
				})
			).rejects.toThrow();
			expect(events.slice(-2)).toEqual([
				{ projectId: denial === 403 ? 'p' : '$projects', status: 'denied' },
				{ projectId: 'caught', status: 'rejected' }
			]);
		} finally {
			await f.cleanup();
		}
	}
);

test('comments from another member refresh at unchanged source/notes and bind the new collaboration revision', async () => {
	const f = await remoteCacheFixture();
	try {
		const query = { ...entity, threadId: 'thread' };
		const first = await f.adapter.snapshot(selection);
		expect((await f.adapter.messages(query))[0].text).toBe('first');
		f.state.collaboration = '2'.repeat(40);
		f.state.text = 'another member comment';
		expect((await f.adapter.messages(query))[0].text).toBe('another member comment');
		const next = await f.adapter.snapshot(selection);
		expect(next.revision.commit).toBe(first.revision.commit);
		expect(next.cache?.identity.notesRevision).toBe(first.cache?.identity.notesRevision);
		expect(next.cache?.identity.collaborationRevision).toBe('2'.repeat(40));
		await f.close();
		expect((await f.adapter.messages(query))[0].text).toBe('another member comment');
	} finally {
		await f.cleanup();
	}
});
test('legacy missing collaboration revision still fetches fresh JSON, malformed revision is refused', async () => {
	const f = await remoteCacheFixture();
	try {
		f.state.collaboration = undefined;
		const query = { ...entity, threadId: 'thread' };
		expect((await f.adapter.messages(query))[0].text).toBe('first');
		f.state.text = 'legacy fresh response';
		expect((await f.adapter.messages(query))[0].text).toBe('legacy fresh response');
		f.state.collaboration = 'not-a-commit';
		await expect(f.adapter.messages(query)).rejects.toThrow('collaboration revision');
	} finally {
		await f.cleanup();
	}
});
