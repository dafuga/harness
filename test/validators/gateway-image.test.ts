import { expect, test } from 'vitest';
import { GatewayImageValidator } from '../../src/validators/GatewayImageValidator';
const png =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const validator = new GatewayImageValidator();

test('Responses, MCP and Claude image shapes preserve bytes and MIME', () => {
	for (const image of [
		{ type: 'input_image', image_url: `data:image/png;base64,${png}` },
		{ type: 'image_url', image_url: { url: `data:image/png;base64,${png}` } },
		{ type: 'image', mimeType: 'image/png', data: png },
		{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: png } }
	])
		expect(validator.parse(image)).toEqual({ data: png, mimeType: 'image/png' });
});

test.each([
	{ mimeType: 'image/jpeg', data: png },
	{ mimeType: 'image/svg+xml', data: png },
	{ mimeType: 'image/png', data: 'a===' },
	{ mimeType: 'image/png', data: 'A'.repeat(7_000_001) }
])('invalid media bytes cannot pass as a usable image', (input) => {
	expect(() => validator.parse(input)).toThrow();
});
