import { expect, test } from 'vitest';
import { hubCache } from '../../src/routes/api/[...path]/hubCache';
import { cacheKey, readCache, writeCache } from 'collaboration';
const identity = {
	principalId: 'google:one',
	projectId: 'a6196e55-8746-4bc5-bfeb-5e2c8771e241',
	repositoryId: 1,
	requestedRef: 'refs/heads/main',
	sourceCommit: 'a'.repeat(40),
	sourceTree: 'b'.repeat(40),
	notesRef: 'refs/notes/harness',
	notesRevision: null,
	evidenceRef: 'refs/heads/harness-evidence',
	evidenceRevision: null,
	historyIndexRevision: null,
	artifactHash: null,
	profile: null
};
test('disposable projection cache isolates principals and notes revisions', async () => {
	const cache = hubCache();
	const bytes = new TextEncoder().encode('project one');
	await writeCache(cache, identity, bytes);
	expect(await readCache(cache, identity)).toEqual(bytes);
	expect(await readCache(cache, { ...identity, principalId: 'google:two' })).toBeNull();
	expect(await readCache(cache, { ...identity, notesRevision: 'c'.repeat(40) })).toBeNull();
});
test('corrupt R2 cache is removed instead of served', async () => {
	const removed: string[] = [];
	const bucket = {
		get: async () => ({
			arrayBuffer: async () => new TextEncoder().encode('broken').buffer,
			customMetadata: {}
		}),
		delete: async (key: string) => {
			removed.push(key);
		}
	} as unknown as R2Bucket;
	const cache = hubCache(bucket);
	expect(await readCache(cache, identity)).toBeNull();
	expect(removed).toHaveLength(1);
});
test('unavailable disposable R2 storage does not prevent rebuilding from GitHub', async () => {
	const fail = async () => {
		throw Error('Unavailable cache');
	};
	const cache = hubCache({ get: fail, put: fail, delete: fail } as unknown as R2Bucket);
	const bytes = new TextEncoder().encode('rebuildable source');
	expect(await readCache(cache, identity)).toBeNull();
	await expect(writeCache(cache, identity, bytes)).resolves.toBeUndefined();
});

import {
	projectionFixture,
	actor,
	project,
	commit,
	cacheEnvelope
} from '../support/projectionFixture';
import { hubSource, hubRead } from '../../src/utils/hubSource';
import { hubBlobProfile } from '../../src/utils/hubRaw';
import { hubHash } from '../../src/utils/hubJson';
test('warm cache cannot hide mismatch between committed bytes and design hash', async () => {
	const f = projectionFixture();
	const path = 'src/pages/example/designs/v001/prompt.md';
	const committed = new TextEncoder().encode('committed A'),
		forged = new TextEncoder().encode('cached B');
	f.files.set(path, committed);
	const context = await hubSource({
		source: f.source,
		cache: f.cache,
		actor,
		project,
		ref: commit
	});
	const entry = context.entries.find((e) => e.path === path)!;
	const hash = await hubHash(forged);
	const identity = {
		...context.identity,
		artifactHash: hash,
		profile: await hubBlobProfile('source', path, entry.sha)
	};
	const key = await cacheKey(identity);
	await f.cache.put(key, cacheEnvelope(identity, forged));
	await expect(hubRead(context, path, hash)).rejects.toThrow();
});
