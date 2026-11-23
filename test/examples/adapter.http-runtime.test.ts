import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { HttpRuntimeAdapter } from '../../src/adapters/execution-runtimes/HttpRuntimeAdapter';

async function withFetchResponse<T>(
	status: number,
	body: string,
	use: () => Promise<T>
): Promise<T> {
	const original = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
	Object.defineProperty(globalThis, 'fetch', {
		configurable: true,
		value: async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(body, { status })
	});
	try {
		return await use();
	} finally {
		if (original) Object.defineProperty(globalThis, 'fetch', original);
	}
}

test('invoke returns a valid envelope from an HTTP response', async () => {
	const request = { operation: 'version' };
	const expected = { ok: true, output: { contract: 'impact-kernel/1' } } as const;
	const output = await withFetchResponse(503, JSON.stringify(expected), async () => {
		const result = await new HttpRuntimeAdapter('http://127.0.0.1:43127/run').invoke(request);
		expect(result).toEqual(expected);
		return result;
	});
	recordExampleCases(
		{
			unitId: 'adapter.http-runtime',
			symbol: 'HttpRuntimeAdapter.invoke',
			state: 'invoke-returns-a-valid-envelope-from-an-http-response',
			evidence: 'examples-cases',
			file: 'invoke-returns-a-valid-envelope-from-an-http-response.json'
		},
		[{ name: 'version request returns the unit envelope despite HTTP 503', input: request, output }]
	);
}, 20_000);

test('invoke rejects non portable JSON before sending a request', async () => {
	const request = { operation: 'impact', input: { score: Number.NaN } };
	const output = await withFetchResponse(200, '', async () => {
		const result = await new HttpRuntimeAdapter('http://127.0.0.1:43127').invoke(request);
		expect(result).toMatchObject({ ok: false, error: { code: 'invalid-json' } });
		return result;
	});
	recordExampleCases(
		{
			unitId: 'adapter.http-runtime',
			symbol: 'HttpRuntimeAdapter.invoke',
			state: 'invoke-rejects-non-portable-json-before-sending-a-request',
			evidence: 'examples-cases',
			file: 'invoke-rejects-non-portable-json-before-sending-a-request.json'
		},
		[
			{
				name: 'non-finite score fails portability validation',
				input: { operation: 'impact', input: { score: 'NaN (non-finite number)' } },
				output
			}
		]
	);
}, 20_000);

test('close resolves without a value', async () => {
	const output = await new HttpRuntimeAdapter('http://127.0.0.1:3001/run').close();
	expect(output).toBeUndefined();
	recordExampleCases(
		{
			unitId: 'adapter.http-runtime',
			symbol: 'HttpRuntimeAdapter.close',
			state: 'close-resolves-without-a-value',
			evidence: 'examples-cases',
			file: 'close-resolves-without-a-value.json'
		},
		[{ name: 'closing the adapter resolves with no value', input: null, output: null }]
	);
}, 20_000);
