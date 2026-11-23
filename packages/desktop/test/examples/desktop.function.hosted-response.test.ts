import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hostedResponse } from '../../src/utils/networking-security/hostedResponse';

async function rejection(response: Response, limit: number) {
	try {
		await hostedResponse(response, limit);
	} catch (error) {
		if (error instanceof Error) return { name: error.name, message: error.message };
	}
	throw new Error('Expected the hosted response to exceed its byte limit.');
}

test('reads response bytes in order up to the limit', async () => {
	const bytes = await hostedResponse(new Response(new Uint8Array([65, 66, 67])), 3);
	const empty = await hostedResponse(new Response(null), 3);

	expect(Array.from(bytes)).toEqual([65, 66, 67]);
	expect(Array.from(empty)).toEqual([]);
	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-response',
			symbol: 'hostedResponse',
			state: 'reads-response-bytes-in-order-up-to-the-limit',
			evidence: 'examples-cases',
			file: 'reads-response-bytes-in-order-up-to-the-limit.json'
		},
		[
			{
				name: 'body exactly at limit',
				input: { chunks: [[65, 66, 67]], limit: 3 },
				output: [65, 66, 67]
			},
			{ name: 'response without a body', input: { body: null, limit: 3 }, output: [] }
		]
	);
});

test('rejects declared and streamed bodies over the limit', async () => {
	const declared = await rejection(
		new Response('too long', { headers: { 'content-length': '4' } }),
		3
	);
	const streamed = await rejection(new Response(new Uint8Array([1, 2, 3, 4])), 3);

	expect(declared.name).toBe('HostedResponseTooLargeError');
	expect(streamed.name).toBe('HostedResponseTooLargeError');
	expect(streamed.message).toBe('Hosted answer exceeds 3 bytes (16 MiB).');
	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-response',
			symbol: 'hostedResponse',
			state: 'rejects-declared-and-streamed-bodies-over-the-limit',
			evidence: 'examples-cases',
			file: 'rejects-declared-and-streamed-bodies-over-the-limit.json'
		},
		[
			{
				name: 'declared length exceeds limit',
				input: { contentLength: '4', limit: 3 },
				error: declared
			},
			{ name: 'stream crosses limit', input: { chunks: [[1, 2, 3, 4]], limit: 3 }, error: streamed }
		]
	);
});
