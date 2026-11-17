import { createHash } from 'node:crypto';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { RemoteArtifactCacheService } from '../../src/lib/development-tooling/desktop-initialization/remote-http-project-adapter/RemoteArtifactCacheService';
import type { Query, Media } from '../../src/lib/development-tooling/desktop-initialization/remote-http-project-adapter/RemoteArtifactCacheService.types';

const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const query: Query = {
	projectId: 'project-alpha',
	entityId: 'reports.component.evidence-grid',
	commit: '2943ac13ce64b486e920a5e69f9ee6719d7c5f54',
	branch: 'main',
	mode: 'commit',
	side: 'after',
	recordId: '2f7335364813f5e38461d534ff8dbc565491db546d1f14f280536022d896b038',
	scenarioId: 'desktop-smoke',
	state: 'ready',
	evidenceId: 'screenshot-main',
	viewport: '1280x800',
	sha256: createHash('sha256').update(bytes).digest('hex'),
	notesRevision: null,
	evidenceRevision: null
};

async function readPinnedArtifact() {
	const calls: Array<{ key: string; projectId: string }> = [];
	const reads = {
		async read<T>(
			request: { key: string; projectId: string },
			load: () => Promise<{ value: T; principalId?: string }>,
			validate: (value: unknown) => T
		) {
			calls.push(request);
			const fresh = await load();
			return { value: validate(fresh.value) };
		}
	};
	const service = new RemoteArtifactCacheService(reads as never);
	const identity = {
		collaborationRevision: null,
		principalId: '12345678901234567890',
		projectId: 'project-alpha',
		repositoryId: 123456789,
		requestedRef: 'main',
		sourceCommit: query.commit,
		sourceTree: '321a8fa6052cf4cc76a7e2b9121abb35f73475c0',
		notesRef: null,
		notesRevision: null,
		evidenceRef: null,
		evidenceRevision: null,
		historyIndexRevision: null,
		artifactHash: null,
		profile: null
	};
	service.pin(identity);
	const media: Media = { bytes, mediaType: 'image/png', principalId: identity.principalId };
	const output = await service.read(
		{ key: '/api/projects/project-alpha/artifact?screenshot-main', query },
		async () => media
	);
	return { output, calls, identity, media };
}

test('Reads and validates a pinned hosted artifact', async () => {
	const { output, calls, identity, media } = await readPinnedArtifact();
	expect({ mediaType: output.mediaType, sha256: output.sha256, bytes: [...output.bytes] }).toEqual({
		mediaType: 'image/png',
		sha256: query.sha256,
		bytes: [...bytes]
	});
	recordExampleCases(
		{
			unitId: 'desktop.service.remote-artifact-cache',
			symbol: 'read',
			state: 'reads-and-validates-a-pinned-hosted-artifact',
			evidence: 'examples-cases',
			file: 'reads-and-validates-a-pinned-hosted-artifact.json'
		},
		[
			{
				name: 'Reads PNG bytes for the requested project and capture',
				input: { key: '/api/projects/project-alpha/artifact?screenshot-main', query, identity, media },
				output: { mediaType: output.mediaType, sha256: output.sha256, bytes: [...output.bytes], calls }
			}
		]
	);
});
