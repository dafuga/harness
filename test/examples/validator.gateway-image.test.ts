import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { GatewayImageValidator } from '../../src/validators/development-tooling/GatewayImageValidator';

const unitId = 'validator.gateway-image';
const state = 'validates-embedded-image-bytes-and-rejects-remote-urls';
const png =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pZsAAAAASUVORK5CYII=';

test('Validates embedded image bytes and rejects remote URLs', () => {
	const validator = new GatewayImageValidator();
	const inputs = [
		{ mimeType: 'image/png', data: png },
		{ image_url: { url: `data:image/png;base64,${png}` } },
		{ image_url: 'https://example.invalid/image.png' }
	];
	const cases = inputs.map((input, index) => {
		try {
			const image = validator.parse(input);
			expect(image).toEqual({ data: png, mimeType: 'image/png' });
			return {
				name: index === 0 ? 'top-level PNG bytes' : 'PNG data URI',
				input,
				output: { mimeType: image.mimeType, dataLength: image.data.length }
			};
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
			const actual = error as Error & { name: string };
			expect(actual.name).toBe('GatewayContentError');
			return {
				name: 'remote URL is unsupported',
				input,
				error: { name: actual.name, message: actual.message }
			};
		}
	});
	recordExampleCases(
		{
			unitId,
			symbol: 'GatewayImageValidator.parse',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
});
