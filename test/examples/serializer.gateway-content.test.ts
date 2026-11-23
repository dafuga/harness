import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { GatewayContentSerializer } from '../../src/serializers/development-tooling/GatewayContentSerializer';

const serializer = () => new GatewayContentSerializer();
const png = 'iVBORw0KGgo=';

test('Normalizes history and extracts inline images', () => {
	const input = [
		{
			role: 'user',
			content: [{ type: 'input_image', source: { media_type: 'image/png', data: png } }]
		}
	];
	const output = serializer().history(input);
	expect(output.images).toEqual([{ data: png, mimeType: 'image/png' }]);
	expect(output.input[0]?.content).toEqual([
		{ type: 'input_image', image_reference: 1, mimeType: 'image/png' }
	]);
	recordExampleCases(
		{
			unitId: 'serializer.gateway-content',
			symbol: 'history',
			state: 'normalizes-history-and-extracts-inline-images',
			evidence: 'examples-cases',
			file: 'normalizes-history-and-extracts-inline-images.json'
		},
		[{ name: 'nested inline PNG becomes a numbered reference', input, output }]
	);
});

test('Formats tool results and preserves error status', () => {
	const outputs = ['{"content":"Build complete."}', '{"isError":true}'];
	const results = outputs.map((output) => serializer().toolResult(output));
	expect(results[0]?.content).toEqual([{ type: 'text', text: outputs[0] }]);
	expect(results[1]?.isError).toBe(true);
	recordExampleCases(
		{
			unitId: 'serializer.gateway-content',
			symbol: 'toolResult',
			state: 'formats-tool-results-and-preserves-error-status',
			evidence: 'examples-cases',
			file: 'formats-tool-results-and-preserves-error-status.json'
		},
		outputs.map((input, index) => ({
			name: `tool output ${index + 1}`,
			input,
			output: results[index]
		}))
	);
});

test('Rejects unsupported attachment types', () => {
	const input = [{ type: 'input_audio', data: 'made-up-audio' }];
	let error: unknown;
	try {
		serializer().history(input);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	expect((error as Error).message).toContain('Audio, video and file attachments are unsupported');
	recordExampleCases(
		{
			unitId: 'serializer.gateway-content',
			symbol: 'history',
			state: 'rejects-unsupported-attachment-types',
			evidence: 'examples-cases',
			file: 'rejects-unsupported-attachment-types.json'
		},
		[
			{
				name: 'audio attachment is rejected',
				input,
				error: { name: (error as Error).name, message: (error as Error).message }
			}
		]
	);
});
