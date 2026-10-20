import { test, expect } from 'vitest';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { remoteCacheFixture } from './remote-cache-fixture';
import { RemoteHttpProjectAdapter } from '../src/adapters/remote-http-project-adapter/RemoteHttpProjectAdapter';
const entity = { projectId: 'p', entityId: 'entity', commit: 'a'.repeat(40) };
test.each(['logout', 'disconnect-start', 'denial', 'principal'] as const)(
	'%s invalidates a previously authorized deferred HTTP read',
	async (action) => {
		const f = await remoteCacheFixture();
		const entering = deferred(),
			holding = deferred();
		let signedIn = true;
		let authorityVersion = 0;
		const events: string[] = [];
		const adapter = new RemoteHttpProjectAdapter({
			...f.options,
			credentials: async () => (signedIn ? f.options.credentials() : null),
			authorityVersion: () => authorityVersion,
			onCacheStatus: (event) => events.push(event.status),
			fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
				const response = await fetch(input, init);
				if (String(input).includes('/source?')) {
					entering.resolve();
					await holding.promise;
				}
				return response;
			}) as typeof fetch
		});
		try {
			const pending = adapter.source({ ...entity, path: 'src/a.ts' });
			await entering.promise;
			if (action === 'logout') {
				signedIn = false;
				await f.cache.clear();
				events.push('denied');
			}
			if (action === 'denial') {
				f.state.status = 403;
				await expect(adapter.entity(entity)).rejects.toThrow();
			}
			if (action === 'disconnect-start') {
				authorityVersion++;
				events.push('denied');
			}
			if (action === 'principal') {
				f.state.principal = 'bob';
				events.push('denied');
			}
			holding.resolve();
			await expect(pending).rejects.toThrow();
			expect(events.at(-1)).toBe('denied');
			expect(
				(await readdir(join(f.root, 'cache')).catch(() => [])).filter((name) =>
					name.startsWith('lookup-')
				)
			).toEqual([]);
		} finally {
			holding.resolve();
			await f.cleanup();
		}
	}
);

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { resolve, promise };
}
