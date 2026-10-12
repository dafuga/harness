import { test, expect } from 'vitest';
import { mkdtemp, rm, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ProjectionCacheService } from '../../src/services/ProjectionCacheService';
import type { CacheIdentity } from '../../../collaboration/src/models/Collaboration.types';
const identity: CacheIdentity = {
	collaborationRevision: '1'.repeat(40),
	principalId: 'verified-a',
	projectId: 'project-a',
	repositoryId: 1,
	requestedRef: 'refs/heads/main',
	sourceCommit: 'a'.repeat(40),
	sourceTree: 'b'.repeat(40),
	notesRef: 'refs/heads/notes',
	notesRevision: 'c'.repeat(40),
	evidenceRef: 'refs/heads/evidence',
	evidenceRevision: 'd'.repeat(40),
	historyIndexRevision: 'e'.repeat(40),
	artifactHash: null,
	profile: null
};
test('cache isolates principal/project and independently changed notes/evidence with the same source commit', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-cache-'));
	try {
		const cache = new ProjectionCacheService(root),
			bytes = Buffer.from('canonical projection');
		const hash = createHash('sha256').update(bytes).digest('hex');
		await cache.put(identity, bytes, hash);
		expect(await cache.get(identity, hash)).toEqual(new Uint8Array(bytes));
		for (const field of [
			'principalId',
			'projectId',
			'notesRevision',
			'evidenceRevision',
			'historyIndexRevision',
			'collaborationRevision',
			'profile'
		] as const)
			expect(await cache.get({ ...identity, [field]: 'changed' }, hash)).toBeNull();
		await expect(cache.put(identity, Buffer.from('corrupt'), hash)).rejects.toThrow('hash');
		const [file] = await readdir(root);
		await writeFile(join(root, file), 'malformed');
		expect(await cache.get(identity, hash)).toBeNull();
		await cache.put(identity, bytes, hash);
		await cache.clear();
		expect(await cache.get(identity, hash)).toBeNull();
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
