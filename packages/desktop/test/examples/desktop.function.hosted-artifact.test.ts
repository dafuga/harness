import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hostedArtifact } from '../../src/adapters/explorer-ui/browser-project-adapter/hostedArtifact';
import { HostedArtifactRefusedError } from '../../src/adapters/explorer-ui/browser-project-adapter/hostedArtifact.types';

const jsonBytes = new Uint8Array([123, 125]);
const jsonSha256 = '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a';

test('returns verified JSON bytes with the normalized declared media type', async () => {
	const input = { bytes: jsonBytes, mediaType: ' application/json; charset=utf-8 ' };
	const result = await hostedArtifact(input, jsonSha256);

	expect(Array.from(result.bytes)).toEqual([123, 125]);
	expect(result).toMatchObject({ mediaType: 'application/json', sha256: jsonSha256 });
	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-artifact',
			symbol: 'hostedArtifact',
			state: 'returns-verified-json-bytes-with-the-normalized-declared-med',
			evidence: 'examples-cases',
			file: 'returns-verified-json-bytes-with-the-normalized-declared-med.json'
		},
		[
			{
				name: 'valid empty JSON object with a parameterized media type',
				input: { bytes: [123, 125], mediaType: input.mediaType, sha256: jsonSha256 },
				output: {
					bytes: Array.from(result.bytes),
					mediaType: result.mediaType,
					sha256: result.sha256
				}
			}
		]
	);
});

test('refuses a hosted artifact with an unsupported media type', async () => {
	let thrown: unknown;
	try {
		await hostedArtifact({ bytes: jsonBytes, mediaType: 'application/octet-stream' }, jsonSha256);
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(HostedArtifactRefusedError);
	if (!(thrown instanceof Error)) throw new Error('Expected a refused hosted artifact.');
	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-artifact',
			symbol: 'hostedArtifact',
			state: 'refuses-a-hosted-artifact-with-an-unsupported-media-type',
			evidence: 'examples-cases',
			file: 'refuses-a-hosted-artifact-with-an-unsupported-media-type.json'
		},
		[
			{
				name: 'reject unsupported binary media type',
				input: { bytes: [123, 125], mediaType: 'application/octet-stream', sha256: jsonSha256 },
				error: { name: thrown.name, message: thrown.message }
			}
		]
	);
});

test('refuses bytes whose digest differs from the requested SHA-256', async () => {
	let thrown: unknown;
	try {
		await hostedArtifact({ bytes: jsonBytes, mediaType: 'application/json' }, '0'.repeat(64));
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(HostedArtifactRefusedError);
	if (!(thrown instanceof Error)) throw new Error('Expected a digest refusal.');
	expect(thrown.message).toContain('SHA-256');
	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-artifact',
			symbol: 'hostedArtifact',
			state: 'refuses-bytes-whose-digest-differs-from-the-requested-sha-25',
			evidence: 'examples-cases',
			file: 'refuses-bytes-whose-digest-differs-from-the-requested-sha-25.json'
		},
		[
			{
				name: 'reject valid JSON with a different expected digest',
				input: { bytes: [123, 125], mediaType: 'application/json', sha256: '0'.repeat(64) },
				error: { name: thrown.name, message: thrown.message }
			}
		]
	);
});
