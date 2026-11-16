import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hostedImage } from '../../src/lib/development-tooling/desktop-initialization/remote-http-project-adapter/hostedImage';
import { InvalidHostedImageError } from '../../src/lib/development-tooling/desktop-initialization/remote-http-project-adapter/hostedImage.types';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const digest = '431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460';

test('decodes and validates a cached PNG', () => {
	const bytes = hostedImage(png, digest);

	expect(bytes).toBeInstanceOf(Uint8Array);
	expect(bytes.length).toBe(68);

	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-image',
			symbol: 'hostedImage',
			state: 'decodes-and-validates-a-cached-png',
			evidence: 'examples-cases',
			file: 'decodes-and-validates-a-cached-png.json'
		},
		[
			{
				name: 'decode the supplied one-pixel PNG',
				input: { value: png, sha256: digest },
				output: { byteLength: bytes.length, byteType: bytes.constructor.name }
			}
		]
	);
});

test('rejects a non-string cached image', () => {
	let thrown: unknown;
	try {
		hostedImage(null, digest);
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(InvalidHostedImageError);
	expect(thrown).toMatchObject({ message: 'Invalid cached image.' });
	if (!(thrown instanceof Error)) throw new Error('Expected an invalid cached image error.');

	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-image',
			symbol: 'hostedImage',
			state: 'rejects-a-non-string-cached-image',
			evidence: 'examples-cases',
			file: 'rejects-a-non-string-cached-image.json'
		},
		[
			{
				name: 'reject a missing cached image value',
				input: { value: null, sha256: digest },
				error: { name: thrown.name, message: thrown.message }
			}
		]
	);
});
