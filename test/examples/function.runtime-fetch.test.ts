import type { Runtime } from './function.runtime-fetch.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { runtimeFetch } from '../../src/utils/execution-runtimes/runtimeFetch';

const unitId = 'function.runtime-fetch';

function fakeRuntime(calls: unknown[]): Runtime {
	const invoke = async (request: unknown) => {
		calls.push(request);
		return { status: 200, value: { answer: 42 } };
	};
	return { kind: 'fake', invoke, close: async () => undefined } as unknown as Runtime;
}

function runtimeWith(invoke: () => Promise<unknown>): Runtime {
	return { kind: 'fake', invoke, close: async () => undefined } as unknown as Runtime;
}

function jsonRequest(body: string): Request {
	return new Request('http://unit.example/run', {
		method: 'POST',
		body,
		headers: { 'content-type': 'application/json' }
	});
}

function describeError(error: unknown): { name: string; message: string } {
	return error instanceof Error
		? { name: error.name, message: error.message }
		: { name: 'unknown', message: '' };
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
	try {
		await promise;
	} catch (error) {
		return error;
	}
	return undefined;
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

test('Throws Error when the runtime invocation fails', async () => {
	const handler = runtimeFetch(
		runtimeWith(() => Promise.reject(new Error('runtime offline')))
	);
	const thrown = await rejectionOf(handler(jsonRequest('{"n":1}')));
	expect(thrown).toBeInstanceOf(Error);
	expect(describeError(thrown)).toEqual({ name: 'Error', message: 'runtime offline' });
	recordExampleCases(
		{
			unitId,
			symbol: 'runtimeFetch',
			state: 'throws-error-when-the-runtime-invocation-fails',
			evidence: 'examples-cases',
			file: 'throws-error-when-the-runtime-invocation-fails.json'
		},
		[
			{
				name: 'runtime invoke rejects while serving a JSON POST',
				input: { method: 'POST', body: '{"n":1}' },
				error: describeError(thrown)
			}
		]
	);
});

test('Throws TypeError when the reply value cannot be serialized', async () => {
	const handler = runtimeFetch(runtimeWith(() => Promise.resolve({ big: BigInt(1) })));
	const thrown = await rejectionOf(handler(jsonRequest('{"n":1}')));
	expect(thrown).toBeInstanceOf(TypeError);
	expect(describeError(thrown).name).toBe('TypeError');
	expect(describeError(thrown).message).toContain('BigInt');
	recordExampleCases(
		{
			unitId,
			symbol: 'runtimeFetch',
			state: 'throws-typeerror-when-the-reply-value-cannot-be-serialized',
			evidence: 'examples-cases',
			file: 'throws-typeerror-when-the-reply-value-cannot-be-serialized.json'
		},
		[
			{
				name: 'runtime returns a BigInt that JSON.stringify cannot serialize',
				input: { method: 'POST', body: '{"n":1}' },
				error: describeError(thrown)
			}
		]
	);
});
