import { afterAll, beforeAll, expect, test } from 'vitest';
import { HandlerRuntimeAdapter } from '../../src/adapters/HandlerRuntimeAdapter';
import { HttpRuntimeAdapter } from '../../src/adapters/HttpRuntimeAdapter';
import { RuntimeServerService, type ServedRuntime } from '../../src/services/RuntimeServerService';
import { runtimeFetch } from '../../src/utils/runtimeFetch';

const runtime = new HandlerRuntimeAdapter((request) =>
	request.operation === 'fail'
		? { ok: false, error: { code: 'refused', message: 'no' } }
		: { ok: true, output: { echoed: request.input ?? null } }
);
const handler = runtimeFetch(runtime);
let node: ServedRuntime;
beforeAll(async () => {
	node = await new RuntimeServerService().serve(runtime, { port: 0 });
});
afterAll(() => node.close());

const attempts: Array<[string, RequestInit]> = [
	['a request', { method: 'POST', body: '{"operation":"echo","input":[1,"two"]}' }],
	['a failure the unit returns', { method: 'POST', body: '{"operation":"fail"}' }],
	['text that is not JSON', { method: 'POST', body: 'nope' }],
	['a method other than POST', { method: 'GET' }]
];

test.each(attempts)('the fetch handler answers %s exactly as the Node server', async (_, init) => {
	const edge = await handler(new Request('https://unit.example/', init));
	const served = await fetch(node.url, init);
	expect(edge.status).toBe(served.status);
	expect(await edge.json()).toEqual(await served.json());
	expect(edge.headers.get('content-type')).toBe(served.headers.get('content-type'));
	expect(edge.headers.get('cache-control')).toBe('no-store');
});

test('the HTTP adapter reaches a unit served by the fetch handler', async () => {
	const original = globalThis.fetch;
	globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) =>
		handler(new Request(input, init))) as typeof fetch;
	try {
		const remote = new HttpRuntimeAdapter('https://unit.example/');
		expect(await remote.invoke({ operation: 'echo', input: 7 })).toEqual({
			ok: true,
			output: { echoed: 7 }
		});
		expect(await remote.invoke({ operation: 'fail' })).toEqual({
			ok: false,
			error: { code: 'refused', message: 'no' }
		});
	} finally {
		globalThis.fetch = original;
	}
});
