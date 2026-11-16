import { afterEach, test, vi } from 'vitest';
import { HarnessHttpAdapter } from '../../src/adapters/networking-security/HarnessHttpAdapter';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

type FetchCall = {
	url: string;
	method: string;
	headers: Record<string, string>;
	redirect: string;
	body?: string;
};

type AdapterReply = Awaited<ReturnType<HarnessHttpAdapter['request']>>;
type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

const defaultTokenConfig = {
	url: 'https://harness.example.com',
	token: 'example-harness-token'
};
const localConfig = { url: 'http://localhost:3000', timeout: 5000 };

afterEach(() => vi.unstubAllGlobals());

function installFakeReplies(): FetchCall[] {
	const fetchCalls: FetchCall[] = [];
	const replies = [
		new Response('{"status":"ready"}', {
			headers: { 'content-type': 'application/json; charset=utf-8' }
		}),
		new Response('{"id":"report-123"}', {
			headers: { 'content-type': 'application/vnd.harness.report+json; version=1' }
		}),
		new Response(new Uint8Array([0x41, 0x00, 0xff]))
	];
	vi.stubGlobal(
		'fetch',
		async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			const reply = replies.shift();
			if (!reply) throw new Error('No fake HTTP reply was configured.');
			const headers: Record<string, string> = {};
			new Headers(init?.headers).forEach((value, key) => {
				headers[key] = value;
			});
			fetchCalls.push({
				url: String(input),
				method: init?.method ?? '',
				headers,
				redirect: init?.redirect ?? 'follow',
				...(typeof init?.body === 'string' ? { body: init.body } : {})
			});
			return reply;
		}
	);
	return fetchCalls;
}

function assertReplies(status: AdapterReply, report: AdapterReply, health: AdapterReply): void {
	expect(status.data).toEqual({ status: 'ready' });
	expect(Array.from(status.bytes)).toEqual(
		Array.from(new TextEncoder().encode('{"status":"ready"}'))
	);
	expect(status.mediaType).toBe('application/json');
	expect(report.data).toEqual({ id: 'report-123' });
	expect(report.mediaType).toBe('application/vnd.harness.report+json');
	expect(Array.from(health.bytes)).toEqual([0x41, 0x00, 0xff]);
	expect(health.data).toBe('A\u0000�');
	expect(health.mediaType).toBe('application/octet-stream');
}

function assertFetchCalls(fetchCalls: FetchCall[]): void {
	expect(fetchCalls).toEqual([
		{
			url: 'https://harness.example.com/api/status?limit=20',
			method: 'GET',
			headers: {
				accept: 'application/json',
				authorization: 'Bearer example-harness-token'
			},
			redirect: 'manual'
		},
		{
			url: 'https://harness.example.com/api/reports',
			method: 'POST',
			headers: {
				accept: 'application/json',
				authorization: 'Bearer example-request-token',
				'content-type': 'application/json'
			},
			redirect: 'manual',
			body: '{"name":"example"}'
		},
		{
			url: 'http://localhost:3000/api/health',
			method: 'GET',
			headers: {
				accept: 'application/json',
				origin: 'http://localhost:3000'
			},
			redirect: 'manual'
		}
	]);
}

function responseCase(
	name: string,
	input: Record<string, unknown>,
	request: FetchCall,
	response: AdapterReply
): ExampleCase {
	return {
		name,
		input,
		output: {
			request,
			response: {
				data: response.data,
				bytes: Array.from(response.bytes),
				mediaType: response.mediaType
			}
		}
	};
}

function exampleCases(
	status: AdapterReply,
	report: AdapterReply,
	health: AdapterReply,
	fetchCalls: FetchCall[]
): ExampleCase[] {
	return [
		responseCase(
			'GET status appends query and uses configured bearer auth',
			{
				config: defaultTokenConfig,
				method: 'GET',
				path: '/api/status',
				request: { query: [['limit', '20']] },
				serverReply: {
					status: 200,
					contentType: 'application/json; charset=utf-8',
					body: '{"status":"ready"}'
				}
			},
			fetchCalls[0],
			status
		),
		responseCase(
			'POST report serializes JSON and uses its per-request token',
			{
				config: defaultTokenConfig,
				method: 'POST',
				path: '/api/reports',
				request: { input: { name: 'example' }, token: 'example-request-token' },
				serverReply: {
					status: 200,
					contentType: 'application/vnd.harness.report+json; version=1',
					body: '{"id":"report-123"}'
				}
			},
			fetchCalls[1],
			report
		),
		responseCase(
			'loopback health decodes text and retains the exact binary body',
			{
				config: localConfig,
				method: 'GET',
				path: '/api/health',
				request: {},
				serverReply: { status: 200, contentType: null, bytes: [0x41, 0x00, 0xff] }
			},
			fetchCalls[2],
			health
		)
	];
}

test('Returns decoded replies with their exact response bytes', async () => {
	const fetchCalls = installFakeReplies();
	const remote = new HarnessHttpAdapter(defaultTokenConfig);
	const status = await remote.request('GET', '/api/status', { query: [['limit', '20']] });
	const report = await remote.request('POST', '/api/reports', {
		input: { name: 'example' },
		token: 'example-request-token'
	});
	const health = await new HarnessHttpAdapter(localConfig).request('GET', '/api/health');
	assertReplies(status, report, health);
	assertFetchCalls(fetchCalls);
	recordExampleCases(
		{
			unitId: 'adapter.networking-security-harness-http',
			symbol: 'HarnessHttpAdapter.request',
			state: 'returns-decoded-replies-with-their-exact-response-bytes',
			evidence: 'examples-cases',
			file: 'returns-decoded-replies-with-their-exact-response-bytes.json'
		},
		exampleCases(status, report, health, fetchCalls)
	);
});
