import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import type { CacheStatus } from '../src/models/ProjectContext.types';
import {
	asked,
	captureOf,
	evidence,
	hubAnswer,
	hubFixture,
	notes,
	png,
	token
} from './hosted-evidence-fixture';

const refused = 'Hosted request failed or access was refused.';

test('kept evidence is served offline after a restart, with its cached time, as an offline read', async () => {
	const f = await hubFixture();
	try {
		const events: CacheStatus[] = [];
		const fresh = await f.adapter(events).evidence(asked);
		expect(fresh).toEqual(hubAnswer());
		// The session and the read are all that stands behind it: no snapshot is asked for.
		expect(f.routes()).toEqual(['/api/auth/status', '/api/projects/p/evidence']);
		const kept = events.at(-1)!;
		expect(kept).toEqual({ projectId: 'p', status: 'fresh', cachedAt: expect.any(String) });
		await f.close();
		const restarted = f.adapter(events);
		expect(await restarted.evidence(asked)).toEqual(fresh);
		expect(events.at(-1)).toEqual({ projectId: 'p', status: 'offline', cachedAt: kept.cachedAt });
		// Nothing is invented for a read that was never answered.
		const unread = [
			{ mode: 'current' as const },
			{ entityId: 'service.feed' },
			{ branch: 'other' },
			{ commit: 'b'.repeat(40) },
			{ projectId: 'q' }
		];
		for (const other of unread)
			await expect(restarted.evidence({ ...asked, ...other })).rejects.toThrow(refused);
	} finally {
		await f.cleanup();
	}
});

test('another principal never reads what one principal kept, and takes nothing from it', async () => {
	const f = await hubFixture();
	try {
		const adapter = f.adapter();
		const kept = await adapter.evidence(asked);
		const shot = captureOf(png);
		await adapter.artifact(shot);
		await f.close();
		f.state.principal = 'bob';
		await expect(adapter.evidence(asked)).rejects.toThrow(refused);
		await expect(adapter.artifact(shot)).rejects.toThrow(refused);
		f.state.principal = 'alice';
		expect(await adapter.evidence(asked)).toEqual(kept);
		expect((await adapter.artifact(shot)).bytes).toEqual(png);
	} finally {
		await f.cleanup();
	}
});

test.each([401, 403, 'signed-out'] as const)(
	'refused access (%s) purges the kept evidence and artifact, and offline cannot bring them back',
	async (denial) => {
		const f = await hubFixture();
		try {
			const events: CacheStatus[] = [];
			const adapter = f.adapter(events);
			await adapter.evidence(asked);
			const shot = captureOf(png);
			await adapter.artifact(shot);
			expect(await f.files()).toHaveLength(4);
			if (denial === 'signed-out') f.state.actor = '';
			else f.state.status = denial;
			await expect(adapter.artifact(shot)).rejects.toThrow();
			const project = denial === 403 ? 'p' : '$projects';
			expect(events.at(-1)).toEqual({ projectId: project, status: 'denied' });
			expect(await f.files()).toEqual([]);
			await f.close();
			await expect(adapter.evidence(asked)).rejects.toThrow();
			await expect(adapter.artifact(shot)).rejects.toThrow();
		} finally {
			await f.cleanup();
		}
	}
);

test.each(['notes', 'evidence'] as const)(
	'a %s-only update is another answer that replaces the kept one, while a capture of the earlier answer stays readable from its own copy',
	async (moved) => {
		const f = await hubFixture();
		try {
			const adapter = f.adapter();
			const first = await adapter.evidence(asked);
			const shot = captureOf(png, first.identity);
			await adapter.artifact(shot);
			f.state[moved] = 'f'.repeat(40);
			const second = await adapter.evidence(asked);
			expect(second.identity).not.toEqual(first.identity);
			expect(second.identity.sourceCommit).toBe(first.identity.sourceCommit);
			// The earlier capture is still asked for at the revisions its answer was pinned to.
			expect((await adapter.artifact(shot)).bytes).toEqual(png);
			const pinned = `notesRevision=${notes}&evidenceRevision=${evidence}`;
			expect(f.state.seen.at(-1)!.url.endsWith(pinned)).toBe(true);
			await f.close();
			expect(await adapter.evidence(asked)).toEqual(second);
			expect((await adapter.artifact(shot)).bytes).toEqual(png);
			// What the new answer lists was never read, so nothing is kept for it.
			await expect(adapter.artifact(captureOf(png, second.identity))).rejects.toThrow(refused);
			// One copy of the evidence and one of the capture: the earlier answer is gone.
			const kinds = (await f.files()).map((name) => name.split('-')[0]);
			expect(kinds).toEqual(['lookup', 'lookup', 'projection', 'projection']);
		} finally {
			await f.cleanup();
		}
	}
);

test('an answer that is malformed or of another read is refused, never kept, and no kept copy stands in for it', async () => {
	const f = await hubFixture();
	try {
		const adapter = f.adapter();
		const good = hubAnswer();
		const bad: Array<[unknown, string | RegExp]> = [
			[{ ...good, extra: true }, /does not accept/],
			[{ scope: good.scope, identity: good.identity, evidence: good.evidence }, /does not accept/],
			[{ invalid: true }, /does not accept/],
			[hubAnswer({ projectId: 'q' }), /another evidence read/],
			[hubAnswer({ mode: 'current' }), /another evidence read/],
			[hubAnswer({ entityId: 'service.feed' }), /another evidence read/],
			[hubAnswer({ principalId: 'bob' }), 'Hosted cache identity mismatch.']
		];
		for (const [answer, words] of bad) {
			f.state.answer = () => answer;
			await expect(adapter.evidence(asked)).rejects.toThrow(words);
		}
		expect(await f.files()).toEqual([]);
		f.state.answer = null;
		await adapter.evidence(asked);
		f.state.answer = () => ({ ...good, extra: true });
		await expect(adapter.evidence(asked)).rejects.toThrow(/does not accept/);
		await f.close();
		// Offline, what is kept is the last accepted answer and never the refused one.
		expect(await adapter.evidence(asked)).toEqual(good);
	} finally {
		await f.cleanup();
	}
});

test('no credential is in a cache key, a file name, a kept file or an address', async () => {
	const f = await hubFixture();
	try {
		const remembered = vi.spyOn(f.cache, 'remember');
		const adapter = f.adapter();
		const answer = await adapter.evidence(asked);
		const shot = captureOf(png, answer.identity);
		await adapter.artifact(shot);
		const keys = remembered.mock.calls.map(([scope]) => JSON.parse(scope) as string[]);
		// A key is the origin, the principal, the project and the address of the read.
		const owner = [f.origin, 'alice', 'p'];
		expect(keys.map((key) => key.slice(0, 3))).toEqual([owner, owner]);
		expect(keys.map((key) => key[3])).toEqual([f.state.seen[1].url, f.state.seen[3].url]);
		const bound = [
			`sha256=${shot.sha256}`,
			`notesRevision=${notes}`,
			`evidenceRevision=${evidence}`
		];
		for (const part of ['side=after', `recordId=${shot.recordId}`, 'viewport=desktop', ...bound])
			expect(keys[1][3]).toContain(part);
		expect(JSON.stringify(remembered.mock.calls.map((call) => call.slice(0, 2)))).not.toContain(
			token
		);
		const names = await f.files();
		expect(names).toHaveLength(4);
		for (const name of names) {
			expect(name).toMatch(/^(projection|lookup)-[a-f0-9]{64}\.json$/);
			expect(await readFile(join(f.directory, name), 'utf8')).not.toContain(token);
		}
		const sent = f.state.seen.map((request) => request.authorization);
		expect(sent).toEqual(Array(4).fill(`Bearer ${token}`));
		expect(f.state.seen.some((request) => request.url.includes(token))).toBe(false);
	} finally {
		await f.cleanup();
	}
});
