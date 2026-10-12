import { expect, test } from 'vitest';
import { collaborationFixture, owner, sourceRepository, anchor } from './githubFixture';
import { cacheKey, readCache, writeCache } from '../src/utils/cacheKey';
import type { CacheEntry, CacheIdentity } from '../src/models/Collaboration.types';
const identity: CacheIdentity = {
	principalId: 'google:owner',
	projectId: '550e8400-e29b-41d4-a716-446655440000',
	repositoryId: 202,
	requestedRef: 'refs/heads/main',
	sourceCommit: 'a'.repeat(40),
	sourceTree: 'b'.repeat(40),
	notesRef: 'refs/notes/harness',
	notesRevision: 'c'.repeat(40),
	evidenceRef: 'refs/heads/evidence',
	evidenceRevision: 'd'.repeat(40),
	historyIndexRevision: 'e'.repeat(40),
	artifactHash: null,
	profile: null
};
test('cache partitions every authority and mutable reference dimension and rejects corruption', async () => {
	const values = new Map<string, CacheEntry>();
	const cache = {
		async get(key: string) {
			return values.get(key) ?? null;
		},
		async put(key: string, value: CacheEntry) {
			values.set(key, value);
		},
		async delete(key: string) {
			values.delete(key);
		}
	};
	const bytes = new TextEncoder().encode('historical source');
	await writeCache(cache, identity, bytes);
	expect(await readCache(cache, identity)).toEqual(bytes);
	for (const change of [
		{ principalId: 'other' },
		{ projectId: crypto.randomUUID() },
		{ repositoryId: 303 },
		{ requestedRef: 'refs/heads/other' },
		{ sourceCommit: 'f'.repeat(40) },
		{ sourceTree: 'f'.repeat(40) },
		{ notesRef: null, notesRevision: null },
		{ notesRevision: 'f'.repeat(40) },
		{ evidenceRef: null, evidenceRevision: null },
		{ evidenceRevision: 'f'.repeat(40) },
		{ historyIndexRevision: null },
		{ artifactHash: 'f'.repeat(64) },
		{ profile: 'mobile' }
	]) {
		expect(await readCache(cache, { ...identity, ...change })).toBeNull();
	}
	const key = await cacheKey(identity);
	values.get(key)!.bytes[0] = 0;
	expect(await readCache(cache, identity)).toBeNull();
	expect(values.has(key)).toBe(false);
	await writeCache(cache, identity, bytes);
	expect(await readCache(cache, identity)).toEqual(bytes);
});

test('comment changes partition cached projections at the same source commit using acknowledged collaboration revision', async () => {
	const { api, remote } = collaborationFixture();
	const project = await api.createProject(owner, {
		name: 'Snapshot',
		repositoryId: sourceRepository.id
	});
	expect(project.collaborationCommit).toBe(remote.revision());
	expect(remote.records().projects[0]).not.toHaveProperty('collaborationCommit');
	const readsBefore = remote.calls.length;
	const before = await api.getProject(owner, project.id);
	expect(
		remote.calls.slice(readsBefore).filter((call) => call.path.includes('/git/ref/'))
	).toHaveLength(1);
	const cached = {
		...identity,
		projectId: project.id,
		collaborationRevision: before.collaborationCommit
	};
	const beforeKey = await cacheKey(cached);
	const posted = await api.addComment(owner, {
		projectId: project.id,
		requestId: crypto.randomUUID(),
		anchor,
		text: 'Human comment changes only collaboration'
	});
	const after = await api.getProject(owner, project.id);
	expect(after.collaborationCommit).toBe(posted.collaborationCommit);
	expect(after.collaborationCommit).not.toBe(before.collaborationCommit);
	expect(await cacheKey({ ...cached, collaborationRevision: after.collaborationCommit })).not.toBe(
		beforeKey
	);
	expect(
		(
			await api.listThreads(owner, {
				projectId: project.id,
				entityId: anchor.entityId,
				commit: anchor.commit
			})
		)[0].comments[0].text
	).toBe('Human comment changes only collaboration');
	expect(await cacheKey(identity)).toBe(
		await cacheKey({ ...identity, collaborationRevision: null })
	);
});
