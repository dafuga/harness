import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import type { CacheIdentity } from '../../../collaboration/src/models/Collaboration.types';
import type { CacheStatus } from '../../src/models/ProjectContext.types';
import { HostedReadService } from '../../src/services/HostedReadService';
import { ProjectionCacheService } from '../../src/services/projection-cache-service/ProjectionCacheService';
import { HostedFailureValidator } from '../../src/validators/HostedFailureValidator';

const origin = 'https://hub.example.invalid';
const identity: CacheIdentity = {
	collaborationRevision: null,
	principalId: 'alice',
	projectId: 'p',
	repositoryId: 7,
	requestedRef: 'main',
	sourceCommit: 'a'.repeat(40),
	sourceTree: 'b'.repeat(40),
	notesRef: 'refs/notes/harness',
	notesRevision: 'c'.repeat(40),
	evidenceRef: 'refs/heads/harness-evidence',
	evidenceRevision: 'd'.repeat(40),
	historyIndexRevision: null,
	artifactHash: null,
	profile: null
};
const offline = async (): Promise<{ value: string }> => {
	throw new HostedFailureValidator('offline');
};
const invalid = 'This kept copy is not what was asked for.';
const refuse = (): string => {
	throw new Error(invalid);
};

test('a kept copy that fails its check offline is let go of, and never served', async () => {
	const root = await mkdtemp(join(tmpdir(), 'hosted-read-discard-'));
	try {
		const events: CacheStatus[] = [];
		const cache = new ProjectionCacheService(root);
		const service = new HostedReadService({
			origin,
			cache,
			credentials: async () => ({ origin, principalId: 'alice', token: 'private-token' }),
			onCacheStatus: (event) => events.push(event)
		});
		const kept = { projectId: 'p', key: 'kept' };
		const other = { projectId: 'p', key: 'other' };
		for (const query of [kept, other])
			await service.read(query, async () => ({ value: query.key, identity }), String);
		// While it passes its check it is what an offline read is given.
		expect(await service.read(kept, offline, String)).toMatchObject({
			value: 'kept',
			offline: true
		});
		const before = events.length;
		await expect(service.read(kept, offline, refuse)).rejects.toThrow(invalid);
		// Nothing was said to be shown from a kept copy, and the copy is gone for good.
		expect(events).toHaveLength(before);
		expect(await readdir(root)).toHaveLength(2);
		await expect(service.read(kept, offline, String)).rejects.toThrow('Hosted request failed');
		expect(await service.read(other, offline, String)).toMatchObject({ value: 'other' });
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
