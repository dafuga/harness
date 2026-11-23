import { createHash } from 'node:crypto';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { browserArtifact } from '../../src/adapters/explorer-ui/browser-project-adapter/browserArtifact';
import { BrowserArtifactError } from '../../src/adapters/explorer-ui/browser-project-adapter/browserArtifact.types';

const png = new Uint8Array([
	137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0,
	0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 248, 207, 192, 240, 31, 0, 5, 0,
	1, 255, 137, 153, 61, 29, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
]);
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('rejects unsupported media while preserving digest failures', async () => {
	const cases = [
		{
			name: 'refuse an unsupported media name',
			input: { media: { bytes: Array.from(png), mediaType: 'text/html' }, sha256: digest(png) },
			promise: browserArtifact({ bytes: png, mediaType: 'text/html' }, digest(png))
		},
		{
			name: 'preserve a digest mismatch from the hosted reader',
			input: { media: { bytes: Array.from(png), mediaType: 'image/png' }, sha256: '0'.repeat(64) },
			promise: browserArtifact({ bytes: png, mediaType: 'image/png' }, '0'.repeat(64))
		}
	];
	const results = await Promise.all(
		cases.map(async (item) => {
			try {
				return {
					name: item.name,
					input: item.input,
					error: await item.promise.then(
						() => null,
						(error: unknown) => error
					)
				};
			} catch (error) {
				return { name: item.name, input: item.input, error };
			}
		})
	);
	expect(results[0]?.error).toBeInstanceOf(BrowserArtifactError);
	expect(results[0]?.error).toMatchObject({
		message: 'The service sent a file of a kind this page does not show.'
	});
	expect(results[1]?.error).toBeInstanceOf(Error);
	if (!(results[1]?.error instanceof Error)) throw new Error('Expected digest failure.');
	expect(results[1].error.message).toContain('SHA-256');
	recordExampleCases(
		{
			unitId: 'hub.function.browser-artifact',
			symbol: 'browserArtifact',
			state: 'rejects-unsupported-media-while-preserving-digest-failures',
			evidence: 'examples-cases',
			file: 'rejects-unsupported-media-while-preserving-digest-failures.json'
		},
		results.map(({ name, input, error }) => ({
			name,
			input,
			error: {
				name: error instanceof Error ? error.name : 'Error',
				message: error instanceof Error ? error.message : String(error)
			}
		}))
	);
});
