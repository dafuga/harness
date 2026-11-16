import { test } from 'vitest';
import { HandlerRuntimeAdapter } from '../../src/components/explorer-ui/harness-compare/HandlerRuntimeAdapter';
import type {
	RuntimeRequest,
	RuntimeResponse
} from '../../../../src/core/execution-runtimes/runtimeTypes.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * Each state calls the real HandlerRuntimeAdapter. The adapter writes nothing and starts no
 * process, so no temporary folder is needed.
 */

const invoked = {
	unitId: 'adapter.handler-runtime',
	symbol: 'HandlerRuntimeAdapter.invoke',
	evidence: 'examples-cases'
};
const closed = { ...invoked, symbol: 'HandlerRuntimeAdapter.close' };

/** The request example of the unit contract: a Button rendered with a label. */
const renderSave: RuntimeRequest = {
	operation: 'render',
	input: { component: 'Button', props: { label: 'Save' } }
};

/** The expected failure envelope, written out here rather than taken from the adapter's helpers. */
function failure(code: string, message: string): RuntimeResponse {
	return { ok: false, error: { code, message } };
}

/** A handler body that throws, as a handler that fails synchronously does. */
function throws(reason: unknown): never {
	throw reason;
}

/** A request whose input holds `arrays` arrays, each one inside the one before it. */
function nestedRequest(arrays: number): RuntimeRequest {
	let input: unknown = 'leaf';
	for (let level = 0; level < arrays; level += 1) input = [input];
	return { operation: 'render', input };
}

test('Invoke returns the ok envelope for any portable request', async () => {
	const envelope: RuntimeResponse = { ok: true, output: { count: 3 } };
	const options = { timeoutMs: 5000 };
	const direct = new HandlerRuntimeAdapter(() => envelope, options);
	const deferred = new HandlerRuntimeAdapter(async () => envelope, options);
	const results = [
		await direct.invoke(renderSave),
		await deferred.invoke(renderSave),
		await direct.invoke(nestedRequest(63))
	];
	expect(results).toEqual([envelope, envelope, envelope]);
	const timed = { options, request: renderSave };
	const deep = { options, request: { operation: 'render', nestedArrays: 63 } };
	recordExampleCases(
		{
			...invoked,
			state: 'invoke-returns-the-ok-envelope-for-any-portable-request',
			file: 'invoke-returns-the-ok-envelope-for-any-portable-request.json'
		},
		[
			{ name: 'a sync handler answers directly', input: timed, output: results[0] },
			{ name: 'an async handler answers with a promise', input: timed, output: results[1] },
			{ name: '63 nested arrays is 64 levels, the limit', input: deep, output: results[2] }
		]
	);
});

test('Invoke reports thrown or rejected errors as runtime-failed', async () => {
	const adapters = [
		new HandlerRuntimeAdapter(() => throws(new Error('handler threw'))),
		new HandlerRuntimeAdapter(() => Promise.reject(new Error('handler rejected'))),
		new HandlerRuntimeAdapter(() => throws('disk full'))
	];
	const results = await Promise.all(adapters.map((adapter) => adapter.invoke(renderSave)));
	expect(results).toEqual([
		failure('runtime-failed', 'handler threw'),
		failure('runtime-failed', 'handler rejected'),
		failure('runtime-failed', 'disk full')
	]);
	recordExampleCases(
		{
			...invoked,
			state: 'invoke-reports-thrown-or-rejected-errors-as-runtime-failed',
			file: 'invoke-reports-thrown-or-rejected-errors-as-runtime-failed.json'
		},
		[
			{ name: 'a handler throws an Error', input: renderSave, output: results[0] },
			{ name: 'a handler rejects with an Error', input: renderSave, output: results[1] },
			{ name: 'a handler throws a plain string', input: renderSave, output: results[2] }
		]
	);
});

test('Invoke answers invalid-json for a non-portable request', async () => {
	const received: RuntimeRequest[] = [];
	const adapter = new HandlerRuntimeAdapter((request) => {
		received.push(request);
		return { ok: true, output: null };
	});
	const requests: RuntimeRequest[] = [
		{ operation: 'render', input: { opacity: NaN } },
		{ operation: 'render', input: { opened: new Date(0) } },
		{ operation: 'render', input: { label: 'bad \uD800' } },
		nestedRequest(64)
	];
	const results = await Promise.all(requests.map((request) => adapter.invoke(request)));
	const invalid = failure('invalid-json', 'request is not valid JSON');
	expect(results).toEqual([invalid, invalid, invalid, invalid]);
	expect(received).toEqual([]);
	const recorded: unknown[] = [
		{ operation: 'render', input: { opacity: { type: 'number', value: 'NaN' } } },
		{ operation: 'render', input: { opened: { type: 'Date', value: '1970-01-01T00:00:00.000Z' } } },
		{ operation: 'render', input: { label: 'bad \uD800' } },
		{ operation: 'render', nestedArrays: 64 }
	];
	recordExampleCases(
		{
			...invoked,
			state: 'invoke-answers-invalid-json-for-a-non-portable-request',
			file: 'invoke-answers-invalid-json-for-a-non-portable-request.json'
		},
		[
			{ name: 'a NaN prop is not a finite number', input: recorded[0], output: results[0] },
			{ name: 'a Date is not a plain object', input: recorded[1], output: results[1] },
			{ name: 'a lone surrogate is not well-formed text', input: recorded[2], output: results[2] },
			{
				name: '64 nested arrays is 65 levels, past the limit',
				input: recorded[3],
				output: results[3]
			}
		]
	);
});

test('Invoke turns a non-envelope value into invalid-response', async () => {
	const returned: Record<string, unknown> = {
		count: { count: 3 },
		render: null,
		save: { ok: true }
	};
	const adapter = new HandlerRuntimeAdapter(
		(request) => returned[request.operation] as RuntimeResponse
	);
	const requests: RuntimeRequest[] = [
		{ operation: 'count', input: { component: 'Toolbar' } },
		{ operation: 'render', input: { component: 'Button' } },
		{ operation: 'save', input: { draft: 'notes' } }
	];
	const results = await Promise.all(requests.map((request) => adapter.invoke(request)));
	const invalid = failure(
		'invalid-response',
		'runtime returned a value that is not a response envelope'
	);
	expect(results).toEqual([invalid, invalid, invalid]);
	recordExampleCases(
		{
			...invoked,
			state: 'invoke-turns-a-non-envelope-value-into-invalid-response',
			file: 'invoke-turns-a-non-envelope-value-into-invalid-response.json'
		},
		[
			{ name: 'a handler returns a bare object', input: requests[0], output: results[0] },
			{ name: 'a handler returns null', input: requests[1], output: results[1] },
			{ name: 'a handler returns ok true without output', input: requests[2], output: results[2] }
		]
	);
});

test('Invoke answers runtime-timeout after the deadline passes', async () => {
	const options = { timeoutMs: 1 };
	const adapter = new HandlerRuntimeAdapter(
		() => new Promise<RuntimeResponse>(() => undefined),
		options
	);
	const result = await adapter.invoke(renderSave);
	expect(result).toEqual(failure('runtime-timeout', 'no response within 1 ms'));
	const timed = { options, request: renderSave };
	recordExampleCases(
		{
			...invoked,
			state: 'invoke-answers-runtime-timeout-after-the-deadline-passes',
			file: 'invoke-answers-runtime-timeout-after-the-deadline-passes.json'
		},
		[{ name: 'a handler that never answers', input: timed, output: result }]
	);
});

test('Close resolves with no value and releases nothing', async () => {
	const adapter = new HandlerRuntimeAdapter(() => ({ ok: true, output: null }));
	const result = await adapter.close();
	expect(result).toBeUndefined();
	recordExampleCases(
		{
			...closed,
			state: 'close-resolves-with-no-value-and-releases-nothing',
			file: 'close-resolves-with-no-value-and-releases-nothing.json'
		},
		[
			{
				name: 'no arguments, no resources',
				input: { arguments: [] },
				output: { type: 'undefined' }
			}
		]
	);
});
