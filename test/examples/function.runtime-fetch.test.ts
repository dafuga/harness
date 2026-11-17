import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { runtimeFetch } from '../../src/utils/execution-runtimes/runtimeFetch';

type Runtime = Parameters<typeof runtimeFetch>[0];

const unitId = 'function.runtime-fetch';

function fakeRuntime(calls: unknown[]): Runtime {
	const invoke = async (request: unknown) => {
		calls.push(request);
		return { status: 200, value: { answer: 42 } };
	};
	return { kind: 'fake', invoke, close: async () => undefined } as unknown as Runtime;
}

function jsonRequest(body: string): Request {
	return new Request('http://unit.example/run', {
		method: 'POST',
		body,
		headers: { 'content-type': 'application/json' }
	});
}

test('Serves a runtime reply as JSON with no-store headers', async () => {
	const calls: unknown[] = [];
	const handler = runtimeFetch(fakeRuntime(calls));
	const response = await handler(jsonRequest('{"n":1}'));
	const body: unknown = await response.json();
	const summary = {
		status: response.status,
		contentType: response.headers.get('content-type'),
		cacheControl: response.headers.get('cache-control'),
		body
	};
	expect(calls).toHaveLength(1);
	expect(summary).toEqual({
		status: 200,
		contentType: 'application/json',
		cacheControl: 'no-store',
		body: { status: 200, value: { answer: 42 } }
	});
	recordExampleCases(
		{
			unitId,
			symbol: 'runtimeFetch',
			state: 'serves-a-runtime-reply-as-json-with-no-store-headers',
			evidence: 'examples-cases',
			file: 'serves-a-runtime-reply-as-json-with-no-store-headers.json'
		},
		[
			{
				name: 'POST with a JSON body returns the runtime value as JSON',
				input: { method: 'POST', body: '{"n":1}' },
				output: summary
			}
		]
	);
});

test('Creating the handler leaves the runtime untouched', async () => {
	const calls: unknown[] = [];
	const handler = runtimeFetch(fakeRuntime(calls));
	const invocationsBeforeRequest = calls.length;
	await handler(jsonRequest('{}'));
	const invocationsAfterRequest = calls.length;
	expect(invocationsBeforeRequest).toBe(0);
	expect(invocationsAfterRequest).toBe(1);
	recordExampleCases(
		{
			unitId,
			symbol: 'runtimeFetch',
			state: 'creating-the-handler-leaves-the-runtime-untouched',
			evidence: 'examples-cases',
			file: 'creating-the-handler-leaves-the-runtime-untouched.json'
		},
		[
			{
				name: 'handler created, then one request is handled',
				input: { requests: 1 },
				output: { invocationsBeforeRequest, invocationsAfterRequest }
			}
		]
	);
});
