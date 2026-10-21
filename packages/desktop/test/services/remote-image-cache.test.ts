import { test, expect, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ProjectionCacheService } from '../../src/services/projection-cache-service/ProjectionCacheService';
import { RemoteImageCacheService } from '../../src/services/RemoteImageCacheService';
test('remote projection cache rejects a different verified principal even when source and image hashes match', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-remote-cache-'));
	try {
		const bytes = Buffer.from('fixture-image'),
			hash = createHash('sha256').update(bytes).digest('hex');
		const identity = {
			principalId: 'verified-one',
			projectId: 'project-one',
			repositoryId: 1,
			requestedRef: 'refs/heads/main',
			sourceCommit: 'a'.repeat(40),
			sourceTree: 'b'.repeat(40),
			notesRef: null,
			notesRevision: null,
			evidenceRef: null,
			evidenceRevision: null,
			historyIndexRevision: null,
			artifactHash: hash,
			profile: null
		};
		const context = {
			identity,
			principalId: identity.principalId,
			query: {
				projectId: identity.projectId,
				entityId: 'page.home',
				commit: identity.sourceCommit,
				version: 'v001',
				sha256: hash
			}
		};
		const service = new RemoteImageCacheService(new ProjectionCacheService(root)),
			load = vi.fn(async () => new Uint8Array(bytes));
		expect(await service.read(context, load)).toEqual(new Uint8Array(bytes));
		await expect(service.read({ ...context, principalId: 'another' }, load)).rejects.toThrow(
			'identity'
		);
		expect(load).toHaveBeenCalledTimes(1);
		expect(
			await service.read(
				{ ...context, identity: { ...identity, notesRevision: 'c'.repeat(40) } },
				load
			)
		).toEqual(new Uint8Array(bytes));
		expect(load).toHaveBeenCalledTimes(2);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
