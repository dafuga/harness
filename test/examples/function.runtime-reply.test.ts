import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { runtimeReply } from '../../src/utils/execution-runtimes/runtimeReply';
import type { RuntimeReply } from '../../src/utils/execution-runtimes/runtimeReply.types';

const methodState = 'rejects-non-post-methods-before-reading';
const invalidState = 'maps-unreadable-or-invalid-json-to-a-client-error';
const acceptedState = 'invokes-portable-post-and-preserves-runtime-replies';

function makeRuntime(response: RuntimeReply['value'], calls: unknown[]) {
	return {
		kind: 'node',
		invoke: async (request: { operation: string; input?: unknown }) => {
			calls.push(request);
			return response;
		},
		close: async () => undefined
	} as unknown as Parameters<typeof runtimeReply>[0];
}

function reply(status: number, code: string, message: string): RuntimeReply {
	return { status, value: { ok: false, error: { code, message } } };
}

test('Rejects non-POST methods before reading', async () => {
	const calls: unknown[] = [];
	const runtime = makeRuntime({ ok: true, output: { accepted: true } }, calls);
	let reads = 0;
	const cases = [];
	for (const method of ['GET', 'post', 'PUT']) {
		const result = await runtimeReply(runtime, method, async () => {
			reads += 1;
			return '{}';
		});
		expect(result).toEqual(reply(405, 'invalid-request', 'send one JSON request per POST'));
		cases.push({ name: `${method} is refused without a body read`, input: { method }, output: result });
	}
	expect([reads, calls]).toEqual([0, []]);
	recordExampleCases({ unitId: 'function.runtime-reply', symbol: 'runtimeReply', state: methodState, evidence: 'examples-cases', file: `${methodState}.json` }, cases);
});

test('Maps unreadable or invalid JSON to a client error', async () => {
	const calls: unknown[] = [];
	const runtime = makeRuntime({ ok: true, output: null }, calls);
	const malformed = await runtimeReply(runtime, 'POST', async () => '{broken');
	const unreadable = await runtimeReply(runtime, 'POST', async () => { throw new Error('fixture read failed'); });
	const expected = reply(400, 'invalid-json', 'request is not valid JSON');
	expect([malformed, unreadable, calls]).toEqual([expected, expected, []]);
	recordExampleCases({ unitId: 'function.runtime-reply', symbol: 'runtimeReply', state: invalidState, evidence: 'examples-cases', file: `${invalidState}.json` }, [
		{ name: 'body is malformed JSON', input: { method: 'POST', body: '{broken' }, output: malformed },
		{ name: 'body reader rejects', input: { method: 'POST', body: '<reader rejection>' }, output: unreadable }
	]);
});

test('Invokes portable POST and preserves runtime replies', async () => {
	const request = { operation: 'accept', input: { item: 'sample-42' } };
	const successCalls: unknown[] = [];
	const successRuntime = makeRuntime({ ok: true, output: { accepted: true } }, successCalls);
	const success = await runtimeReply(successRuntime, 'POST', async () => JSON.stringify(request));
	const failureCalls: unknown[] = [];
	const runtimeFailure = { ok: false, error: { code: 'fixture-error', message: 'request declined' } } as const;
	const failureRuntime = makeRuntime(runtimeFailure, failureCalls);
	const failure = await runtimeReply(failureRuntime, 'POST', async () => JSON.stringify(request));
	expect([success, failure, successCalls, failureCalls]).toEqual([
		{ status: 200, value: { ok: true, output: { accepted: true } } },
		{ status: 200, value: runtimeFailure },
		[request], [request]
	]);
	recordExampleCases({ unitId: 'function.runtime-reply', symbol: 'runtimeReply', state: acceptedState, evidence: 'examples-cases', file: `${acceptedState}.json` }, [
		{ name: 'portable request returns runtime success', input: { method: 'POST', body: request }, output: success },
		{ name: 'portable request preserves runtime failure', input: { method: 'POST', body: request }, output: failure }
	]);
});
