import { Buffer } from 'node:buffer';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GptImageAdapter } from '../../src/adapters/agents-providers/GptImageAdapter';
import type { ImageFetch } from '../../src/adapters/agents-providers/GptImageAdapter.types';
import { ImageGenerationError } from '../../src/adapters/agents-providers/ImageGenerationError';

const key = 'sk-proj-EXAMPLE00000000000000000000000000000001';
const prompt =
	'A stone pyramid bathed in moonlight on a dark desert plateau, painterly game-art style';
const png = Buffer.from('89504e470d0a1a0a', 'hex');

function responseForPng(): Response {
	return new Response(JSON.stringify({ data: [{ b64_json: png.toString('base64') }] }), {
		status: 200
	});
}

test('generate sends request and decodes PNG', async () => {
	let requestUrl = '';
	let requestOptions: RequestInit | undefined;
	const send: ImageFetch = async (url, options) => {
		requestUrl = url;
		requestOptions = options;
		return responseForPng();
	};
	const output = await new GptImageAdapter(send).generate(key, prompt);
	const requestBody = JSON.parse(String(requestOptions?.body)) as Record<string, unknown>;
	expect(output).toEqual(png);
	expect(requestUrl).toBe('https://api.openai.com/v1/images/generations');
	expect(requestOptions?.method).toBe('POST');
	expect(requestOptions?.headers).toEqual({
		Authorization: 'Bearer ' + key,
		'Content-Type': 'application/json'
	});
	expect(requestBody).toEqual({
		model: 'gpt-image-2',
		prompt,
		n: 1,
		size: '1536x1024',
		quality: 'medium',
		output_format: 'png'
	});
	recordExampleCases(
		{
			unitId: 'game.adapter.gpt-image',
			symbol: 'GptImageAdapter.generate',
			state: 'generate-sends-request-and-decodes-png',
			evidence: 'examples-cases',
			file: 'generate-sends-request-and-decodes-png.json'
		},
		[
			{
				name: 'image generation returns the PNG signature bytes',
				input: { key, prompt },
				output: {
					url: requestUrl,
					method: requestOptions?.method,
					authorization: (requestOptions?.headers as Record<string, string>).Authorization,
					body: requestBody,
					pngHex: output.toString('hex')
				}
			}
		]
	);
});

test('generate reports a non-OK provider response', async () => {
	const send: ImageFetch = async () => new Response('unavailable', { status: 503 });
	const adapter = new GptImageAdapter(send);
	let caught: unknown;
	try {
		await adapter.generate(key, prompt);
	} catch (error) {
		caught = error;
	}
	expect(caught).toBeInstanceOf(ImageGenerationError);
	expect((caught as Error).message).toBe('Image generation failed (HTTP 503). No retry was made.');
	recordExampleCases(
		{
			unitId: 'game.adapter.gpt-image',
			symbol: 'GptImageAdapter.generate',
			state: 'generate-reports-a-non-ok-provider-response',
			evidence: 'examples-cases',
			file: 'generate-reports-a-non-ok-provider-response.json'
		},
		[
			{
				name: 'HTTP 503 is reported without retrying',
				input: { key, prompt, status: 503 },
				error: { name: (caught as Error).name, message: (caught as Error).message }
			}
		]
	);
});

test('Throws ImageGenerationError when the provider payload is invalid', async () => {
	const send: ImageFetch = async () => new Response('not-json', { status: 200 });
	let caught: unknown;
	try {
		await new GptImageAdapter(send).generate(key, prompt);
	} catch (error) {
		caught = error;
	}
	expect(caught).toBeInstanceOf(ImageGenerationError);
	expect((caught as Error).message).toBe('Provider did not return a PNG image.');
	recordExampleCases(
		{
			unitId: 'game.adapter.gpt-image',
			symbol: 'GptImageAdapter.generate',
			state: 'throws-imagegenerationerror-when-the-provider-payload-is-inv',
			evidence: 'examples-cases',
			file: 'throws-imagegenerationerror-when-the-provider-payload-is-inv.json'
		},
		[
			{
				name: 'non-JSON provider response is rejected',
				input: { key, prompt, body: 'not-json' },
				error: { name: (caught as Error).name, message: (caught as Error).message }
			}
		]
	);
});

test('Throws TypeError when the request resolves without a response', async () => {
	const send: ImageFetch = async () => null as unknown as Response;
	let caught: unknown;
	try {
		await new GptImageAdapter(send).generate(key, prompt);
	} catch (error) {
		caught = error;
	}
	expect(caught).toBeInstanceOf(TypeError);
	recordExampleCases(
		{
			unitId: 'game.adapter.gpt-image',
			symbol: 'GptImageAdapter.generate',
			state: 'throws-typeerror-when-the-request-resolves-without-a-respons',
			evidence: 'examples-cases',
			file: 'throws-typeerror-when-the-request-resolves-without-a-respons.json'
		},
		[
			{
				name: 'null response causes the unguarded ok read to throw',
				input: { key, prompt, response: null },
				error: { name: (caught as Error).name, message: (caught as Error).message }
			}
		]
	);
});
