import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { artifactBytes } from '../../src/components/shared-primitives/recorded-preview/artifactBytes';
import { ArtifactReadError } from '../../src/components/shared-primitives/recorded-preview/artifactBytes.types';
import { unreadArtifact, damagedArtifact } from '../../src/utils/shared-primitives/artifactBytes';

type Bridge = Parameters<typeof artifactBytes>[0];
type Query = Parameters<typeof artifactBytes>[1];

const ABC = new TextEncoder().encode('abc');
const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const OTHER_SHA256 = '0c3f8e2a9d61b47f5e08c2d3a9b1f6e4d7c25a0b8e9f13d6a4c72b5e8f09d1a3';

const captureQuery: Query = {
	entityId: 'reports.component.evidence-grid',
	commit: '4c1e8a7f2b9d03e6a5c8f1d7b2e9043a6d5c8f17',
	branch: 'main',
	mode: 'current',
	side: 'after',
	recordId: '3f1c9a0e7b5d24c8a6e1f90b2d47c835e6a1b9d0f4c27e83a5b6d1c9f0e2a7b4',
	scenarioId: 'feed-run',
	state: 'default',
	evidenceId: 'run',
	viewport: null,
	sha256: ABC_SHA256,
	notesRevision: '9b2f47d1c0e8a35f6b74d2e19c0a8f3e5d6b7c48',
	evidenceRevision: 'e7d1a4c90b3f68a2d5e0c7b19f4a6d823c5e0b71'
};

/** A connection whose reader answers with the given bytes and a claimed hash, recording each query. */
function readerReturning(bytes: Uint8Array, claimed: string) {
	const seen: Query[] = [];
	const bridge: Bridge = {
		artifact: async (query) => {
			seen.push(query);
			return { bytes, mediaType: 'text/plain', sha256: claimed };
		}
	};
	return { bridge, seen };
}

/** Resolves to the rejection reason, or undefined when the promise resolves. */
async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
	return promise.then(
		() => undefined,
		(error: unknown) => error
	);
}

function errorSummary(error: unknown) {
	if (!(error instanceof Error)) throw new Error('Expected an Error.');
	return { name: error.name, message: error.message };
}

test('Returns the checked bytes when the hash matches the query', async () => {
	const { bridge, seen } = readerReturning(ABC, 'a-claimed-hash-that-is-ignored');
	const result = await artifactBytes(bridge, captureQuery);

	expect(seen).toHaveLength(1);
	expect(seen[0]).toBe(captureQuery);
	expect(result.sha256).toBe(ABC_SHA256);
	expect(result.mediaType).toBe('text/plain');
	expect(new TextDecoder().decode(result.bytes)).toBe('abc');

	recordExampleCases(
		{
			unitId: 'desktop.function.artifact-bytes',
			symbol: 'artifactBytes',
			state: 'returns-the-checked-bytes-when-the-hash-matches-the-query',
			evidence: 'examples-cases',
			file: 'returns-the-checked-bytes-when-the-hash-matches-the-query.json'
		},
		[
			{
				name: 'matching bytes with a claimed hash that is ignored',
				input: {
					scenarioId: captureQuery.scenarioId,
					evidenceId: captureQuery.evidenceId,
					sha256: ABC_SHA256
				},
				output: {
					text: new TextDecoder().decode(result.bytes),
					mediaType: result.mediaType,
					sha256: result.sha256
				}
			}
		]
	);
});

test('Refuses a connection that has no artifact reader', async () => {
	const thrown = await rejectionOf(artifactBytes({}, captureQuery));

	expect(thrown).toBeInstanceOf(ArtifactReadError);
	expect(thrown).toMatchObject({ name: 'ArtifactReadError', message: unreadArtifact });

	recordExampleCases(
		{
			unitId: 'desktop.function.artifact-bytes',
			symbol: 'artifactBytes',
			state: 'refuses-a-connection-that-has-no-artifact-reader',
			evidence: 'examples-cases',
			file: 'refuses-a-connection-that-has-no-artifact-reader.json'
		},
		[
			{
				name: 'connection without an artifact reader',
				input: { hasArtifactReader: false, sha256: ABC_SHA256 },
				error: errorSummary(thrown)
			}
		]
	);
});

test('Refuses bytes that do not hash to the recorded SHA-256', async () => {
	const { bridge } = readerReturning(ABC, ABC_SHA256);
	const thrown = await rejectionOf(
		artifactBytes(bridge, { ...captureQuery, sha256: OTHER_SHA256 })
	);

	expect(thrown).toBeInstanceOf(ArtifactReadError);
	expect(thrown).toMatchObject({ name: 'ArtifactReadError', message: damagedArtifact });

	recordExampleCases(
		{
			unitId: 'desktop.function.artifact-bytes',
			symbol: 'artifactBytes',
			state: 'refuses-bytes-that-do-not-hash-to-the-recorded-sha-256',
			evidence: 'examples-cases',
			file: 'refuses-bytes-that-do-not-hash-to-the-recorded-sha-256.json'
		},
		[
			{
				name: 'bytes that hash to another value than the query records',
				input: { bytesText: 'abc', claimedSha256: ABC_SHA256, recordedSha256: OTHER_SHA256 },
				error: errorSummary(thrown)
			}
		]
	);
});
