import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { analyticsCpuClient } from '../../src/components/reports-media/analytics-cpu/analyticsCpuClient';
import type { CpuState } from '../../src/utils/reports-media/analyticsCpuClient';
import type { FakeResponse, FetchCall } from './reports.function.analytics-cpu-client.test.types';

const snapshot = {
	status: 'available',
	sampledAt: '2026-11-16T10:00:00.000Z',
	intervalMs: 5000,
	logicalCores: 8,
	machinePercent: 42.5,
	trackedPercent: 12.5,
	groups: [],
	agents: []
} as const;

function okResponse(body: unknown): FakeResponse {
	return { ok: true, json: () => Promise.resolve(body) };
}

function meta(state: string) {
	return {
		unitId: 'reports.function.analytics-cpu-client',
		symbol: 'analyticsCpuClient',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

// Starts a client with a fake fetch and resolves `ready` on the first update.
function start(respond: () => Promise<FakeResponse>) {
	const calls: FetchCall[] = [];
	const original = globalThis.fetch;
	globalThis.fetch = ((url: string, init?: RequestInit) => {
		calls.push({ url, cache: init?.cache, abortable: init?.signal instanceof AbortSignal });
		return respond();
	}) as unknown as typeof fetch;
	const updates: CpuState[] = [];
	let notify = (): void => undefined;
	const ready = new Promise<void>((resolve) => {
		notify = resolve;
	});
	const client = analyticsCpuClient((sample) => {
		updates.push(sample);
		notify();
	});
	return {
		client,
		calls,
		updates,
		ready,
		finish: () => {
			client.stop();
			globalThis.fetch = original;
		}
	};
}

test('Publishes the parsed CPU snapshot', async () => {
	const run = start(() => Promise.resolve(okResponse(snapshot)));
	try {
		await run.ready;
		expect(run.calls).toEqual([{ url: '/api/analytics-cpu', cache: 'no-store', abortable: true }]);
		expect(run.updates).toEqual([snapshot]);
	} finally {
		run.finish();
	}
	recordExampleCases(meta('publishes-the-parsed-cpu-snapshot'), [
		{
			name: 'analytics endpoint answers ok with a snapshot',
			input: { httpOk: true, body: snapshot },
			output: run.updates[0]
		}
	]);
});

test('Reports null for a failed HTTP response', async () => {
	const run = start(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }));
	try {
		await run.ready;
		expect(run.updates).toEqual([null]);
	} finally {
		run.finish();
	}
	recordExampleCases(meta('reports-null-for-a-failed-http-response'), [
		{
			name: 'analytics endpoint answers with a server error',
			input: { httpOk: false },
			output: null
		}
	]);
});

test('Reports null when the request rejects', async () => {
	const run = start(() => Promise.reject(new TypeError('network unreachable')));
	try {
		await run.ready;
		expect(run.updates).toEqual([null]);
	} finally {
		run.finish();
	}
	recordExampleCases(meta('reports-null-when-the-request-rejects'), [
		{
			name: 'network request fails before a response',
			input: { requestRejects: true, reason: 'TypeError' },
			output: null
		}
	]);
});

test('Reports null when the body is not JSON', async () => {
	const invalidBody = () => Promise.reject(new SyntaxError('Unexpected token'));
	const run = start(() => Promise.resolve({ ok: true, json: invalidBody }));
	try {
		await run.ready;
		expect(run.updates).toEqual([null]);
	} finally {
		run.finish();
	}
	recordExampleCases(meta('reports-null-when-the-body-is-not-json'), [
		{
			name: 'ok response carries a body that is not JSON',
			input: { httpOk: true, body: 'not json' },
			output: null
		}
	]);
});

test('Makes no request or report after stop', async () => {
	const run = start(() => Promise.resolve(okResponse(snapshot)));
	try {
		await run.ready;
		run.client.stop();
		await run.client.refresh();
		expect(run.calls).toHaveLength(1);
		expect(run.updates).toHaveLength(1);
	} finally {
		run.finish();
	}
	recordExampleCases(meta('makes-no-request-or-report-after-stop'), [
		{
			name: 'refresh is called once the client has stopped',
			input: { afterStop: true },
			output: { requests: run.calls.length, updates: run.updates.length }
		}
	]);
});
