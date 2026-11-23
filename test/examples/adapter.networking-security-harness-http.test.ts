import type { FetchCall, Reply } from './adapter.networking-security-harness-http.test.types';
import { afterEach, test, vi } from 'vitest';
import { HarnessHttpAdapter } from '../../src/adapters/networking-security/HarnessHttpAdapter';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';
const unitId = 'adapter.networking-security-harness-http';
const config = { url: 'https://harness.example.com', token: 'example-harness-token' };
const local = { url: 'http://localhost:3000', timeout: 5000 };
afterEach(() => vi.unstubAllGlobals());

function record(
	state: string,
	symbol: string,
	cases: Array<{ name: string; input: unknown; output?: unknown; error?: unknown }>
): void {
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases as Parameters<typeof recordExampleCases>[1]
	);
}

function fakeReplies(): FetchCall[] {
	const calls: FetchCall[] = [];
	const replies = [
		new Response('{"status":"ready"}', {
			headers: { 'content-type': 'application/json; charset=utf-8' }
		}),
		new Response('{"id":"report-123"}', {
			headers: { 'content-type': 'application/vnd.harness.report+json; version=1' }
		}),
		new Response(new Uint8Array([65, 0, 255]))
	];
	vi.stubGlobal('fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
		const headers: Record<string, string> = {};
		new Headers(init?.headers).forEach((value, key) => {
			headers[key] = value;
		});
		calls.push({
			url: String(url),
			method: init?.method ?? '',
			headers,
			redirect: init?.redirect ?? 'follow',
			...(typeof init?.body === 'string' ? { body: init.body } : {})
		});
		const reply = replies.shift();
		if (!reply) throw new Error('No fake HTTP reply was configured.');
		return reply;
	});
	return calls;
}

function summarize(reply: Reply): unknown {
	return { data: reply.data, bytes: Array.from(reply.bytes), mediaType: reply.mediaType };
}

test('Returns decoded replies with their exact response bytes', async () => {
	const calls = fakeReplies();
	const status = await new HarnessHttpAdapter(config).request('GET', '/api/status', {
		query: [['limit', '20']]
	});
	const report = await new HarnessHttpAdapter(config).request('POST', '/api/reports', {
		input: { name: 'example' },
		token: 'example-request-token'
	});
	const health = await new HarnessHttpAdapter(local).request('GET', '/api/health');
	expect(summarize(status)).toEqual({
		data: { status: 'ready' },
		bytes: Array.from(new TextEncoder().encode('{"status":"ready"}')),
		mediaType: 'application/json'
	});
	expect(summarize(report)).toMatchObject({
		data: { id: 'report-123' },
		mediaType: 'application/vnd.harness.report+json'
	});
	expect(summarize(health)).toEqual({
		data: 'A\u0000�',
		bytes: [65, 0, 255],
		mediaType: 'application/octet-stream'
	});
	record('returns-decoded-replies-with-their-exact-response-bytes', 'HarnessHttpAdapter.request', [
		{
			name: 'GET status appends query and uses configured bearer auth',
			input: { config, method: 'GET', path: '/api/status', query: [['limit', '20']] },
			output: { request: calls[0], response: summarize(status) }
		},
		{
			name: 'POST report serializes JSON and uses its per-request token',
			input: { config, method: 'POST', path: '/api/reports', body: { name: 'example' } },
			output: { request: calls[1], response: summarize(report) }
		},
		{
			name: 'loopback health retains exact binary response bytes',
			input: { config: local, method: 'GET', path: '/api/health' },
			output: { request: calls[2], response: summarize(health) }
		}
	]);
});

test('Throws ExpectedCliError when the server URL is not secure', () => {
	const input = { url: 'http://harness.example.com' };
	let error: unknown;
	try {
		new HarnessHttpAdapter(input);
	} catch (caught) {
		error = caught;
	}
	expect(error).toMatchObject({ name: 'ExpectedCliError' });
	record(
		'throws-expectedclierror-when-the-server-url-is-not-secure',
		'HarnessHttpAdapter.constructor',
		[{ name: 'remote HTTP origin is rejected', input, error: { name: 'ExpectedCliError' } }]
	);
});

test('Throws TimeoutError when the response body exceeds the deadline', async () => {
	vi.stubGlobal(
		'fetch',
		async (_url: RequestInfo | URL, init?: RequestInit) =>
			new Response(
				new ReadableStream<Uint8Array>({
					start(controller) {
						init?.signal?.addEventListener('abort', () =>
							controller.error(new DOMException('deadline', 'TimeoutError'))
						);
					}
				}),
				{ headers: { 'content-type': 'application/json' } }
			)
	);
	const input = {
		config: { url: 'https://harness.example.com', timeout: 10 },
		method: 'GET',
		path: '/api/status'
	};
	let error: unknown;
	try {
		await new HarnessHttpAdapter(input.config).request(input.method, input.path);
	} catch (caught) {
		error = caught;
	}
	expect(error).toMatchObject({ name: 'TimeoutError' });
	record(
		'throws-timeouterror-when-the-response-body-exceeds-the-deadl',
		'HarnessHttpAdapter.request',
		[
			{
				name: 'body read is aborted by its deadline',
				input,
				error: { name: error instanceof Error ? error.name : 'TimeoutError' }
			}
		]
	);
});

test('Throws TypeError when a request body cannot be serialized', async () => {
	const input = { config: { url: 'https://harness.example.com' }, body: { value: 1n } };
	let error: unknown;
	try {
		await new HarnessHttpAdapter(input.config).request('POST', '/api/reports', {
			input: input.body
		});
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(TypeError);
	record(
		'throws-typeerror-when-a-request-body-cannot-be-serialized',
		'HarnessHttpAdapter.request',
		[
			{
				name: 'BigInt JSON body is rejected before fetch',
				input: { config: input.config, method: 'POST', path: '/api/reports', body: 'BigInt' },
				error: { name: 'TypeError' }
			}
		]
	);
});
