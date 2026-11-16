import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { browserApi } from '../../src/routes/browserApi';

test('Reads same-origin JSON and omits empty query values', async () => {
	const requests: Array<{ url: string; options: RequestInit }> = [];
	const api = browserApi(async (input, options) => {
		requests.push({ url: String(input), options: options ?? {} });
		return Response.json({ ready: true });
	});
	const output = await api.get<{ ready: boolean }>('/api/status', {
		view: 'compact',
		empty: '',
		missing: null
	});
	const result = {
		output,
		url: requests[0]?.url,
		credentials: requests[0]?.options.credentials,
		cache: requests[0]?.options.cache
	};
	expect(result).toEqual({
		output: { ready: true },
		url: '/api/status?view=compact',
		credentials: 'same-origin',
		cache: 'no-store'
	});
	recordExampleCases(
		{
			unitId: 'hub.function.browser-api',
			symbol: 'browserApi.get',
			state: 'reads-same-origin-json-and-omits-empty-query-values',
			evidence: 'examples-cases',
			file: 'reads-same-origin-json-and-omits-empty-query-values.json'
		},
		[{ name: 'status with one useful query value', input: { path: '/api/status', query: { view: 'compact', empty: '', missing: null } }, output: result }]
	);
});

test('Sends JSON writes with same-origin request settings', async () => {
	const requests: Array<{ url: string; options: RequestInit }> = [];
	const api = browserApi(async (input, options) => {
		requests.push({ url: String(input), options: options ?? {} });
		return Response.json({ saved: true });
	});
	const output = await api.send<{ saved: boolean }>('POST', '/api/preferences', { theme: 'dark' });
	const request = requests[0];
	const result = {
		output,
		url: request?.url,
		method: request?.options.method,
		credentials: request?.options.credentials,
		cache: request?.options.cache,
		headers: request?.options.headers,
		body: request?.options.body
	};
	expect(result).toEqual({
		output: { saved: true },
		url: '/api/preferences',
		method: 'POST',
		credentials: 'same-origin',
		cache: 'no-store',
		headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		body: JSON.stringify({ theme: 'dark' })
	});
	recordExampleCases(
		{
			unitId: 'hub.function.browser-api',
			symbol: 'browserApi.send',
			state: 'sends-json-writes-with-same-origin-request-settings',
			evidence: 'examples-cases',
			file: 'sends-json-writes-with-same-origin-request-settings.json'
		},
		[{ name: 'save a preference', input: { method: 'POST', path: '/api/preferences', body: { theme: 'dark' } }, output: result }]
	);
});

test('Returns response bytes for an API download', async () => {
	const api = browserApi(async () => new Response(new Uint8Array([1, 2, 3])));
	const bytes = await api.bytes('/api/download');
	const output = Array.from(bytes);
	expect(output).toEqual([1, 2, 3]);
	recordExampleCases(
		{
			unitId: 'hub.function.browser-api',
			symbol: 'browserApi.bytes',
			state: 'returns-response-bytes-for-an-api-download',
			evidence: 'examples-cases',
			file: 'returns-response-bytes-for-an-api-download.json'
		},
		[{ name: 'three-byte download', input: { path: '/api/download' }, output }]
	);
});

test('Reports coded HTTP refusals to the failure callback', async () => {
	let failure: { status: number; code: string; message: string } | undefined;
	const api = browserApi(
		async () => Response.json({ error: 'SESSION_EXPIRED' }, { status: 401 }),
		(error) => {
			failure = { status: error.status, code: error.code, message: error.message };
		}
	);
	let caught = false;
	try {
		await api.get('/api/profile');
	} catch {
		caught = true;
	}
	expect({ caught, failure }).toEqual({
		caught: true,
		failure: { status: 401, code: 'SESSION_EXPIRED', message: expect.any(String) }
	});
	recordExampleCases(
		{
			unitId: 'hub.function.browser-api',
			symbol: 'browserApi.failed',
			state: 'reports-coded-http-refusals-to-the-failure-callback',
			evidence: 'examples-cases',
			file: 'reports-coded-http-refusals-to-the-failure-callback.json'
		},
		[{ name: 'expired session response', input: { path: '/api/profile', status: 401, code: 'SESSION_EXPIRED' }, output: failure }]
	);
});
