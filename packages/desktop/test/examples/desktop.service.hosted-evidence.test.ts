import { createHash } from 'node:crypto';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { HostedEvidenceService } from '../../src/lib/development-tooling/desktop-initialization/remote-http-project-adapter/HostedEvidenceService';
import type { Transport } from '../../src/lib/development-tooling/desktop-initialization/remote-http-project-adapter/HostedEvidenceService.types';

test('Returns a verified hosted evidence artifact', async () => {
	const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
	const sha256 = createHash('sha256').update(bytes).digest('hex');
	const query = {
		projectId: 'project-alpha',
		entityId: 'desktop.service.hosted-evidence',
		commit: 'd34db33f9e1a42c5b71d08a6e4c32f9012345678',
		branch: 'main',
		mode: 'current' as const,
		side: 'after' as const,
		recordId: 'record-001',
		scenarioId: 'checkout',
		state: 'confirmed',
		evidenceId: 'order-confirmation',
		viewport: 'desktop-1440x900',
		sha256,
		notesRevision: null,
		evidenceRevision: null
	};
	const transport: Transport = {
		path: (_operation, value) => `${value.projectId}/${value.entityId}`,
		evidence: async () => ({}),
		artifact: async () => ({ bytes, mediaType: 'image/png', principalId: 'principal-42' })
	};
	const service = new HostedEvidenceService(transport, {
		origin: 'https://hosted.example.test',
		credentials: async () => ({
			origin: 'https://hosted.example.test',
			principalId: 'principal-42',
			token: 'example-token'
		})
	});
	const result = await service.artifact(query);
	expect({ bytes: Array.from(result.bytes), mediaType: result.mediaType, sha256: result.sha256 }).toEqual({
		bytes: Array.from(bytes),
		mediaType: 'image/png',
		sha256
	});
	recordExampleCases(
		{
			unitId: 'desktop.service.hosted-evidence',
			symbol: 'artifact',
			state: 'returns-a-verified-hosted-evidence-artifact',
			evidence: 'examples-cases',
			file: 'returns-a-verified-hosted-evidence-artifact.json'
		},
		[
			{
				name: 'Valid PNG artifact returns its bytes, media type, and requested digest',
				input: { ...query, bytes: Array.from(bytes), principalId: 'principal-42' },
				output: { bytes: Array.from(result.bytes), mediaType: result.mediaType, sha256: result.sha256 }
			}
		]
	);
});
