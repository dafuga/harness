import { test, vi, type Mock } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { createThreadRunStore } from '../../src/lib/stores/development-tooling/threadRun.svelte';
import type { Workspace } from '../../src/lib/stores/projects-sessions/workspace.svelte';
import type { RunRequest } from '../../src/models/development-tooling/DesktopBridge.types';

/** Synthetic request: the store reads only mode and writes environment. */
const request = (mode: 'plan' | 'change') => ({ mode, projectId: 'project-7' }) as RunRequest;

/** Synthetic bridge: records run calls and never reaches a provider, service or network. */
function bridgeStub(runId = 'run-1') {
	return {
		startRun: vi.fn<(input: RunRequest) => Promise<{ runId: string }>>(async () => ({ runId })),
		cancelRun: vi.fn(async () => true)
	};
}

/** Synthetic workspace: only the fields the store reads, with refresh stubbed. */
function workspaceStub(bridge: unknown, extra: Record<string, unknown> = {}) {
	const refresh = vi.fn(async () => undefined);
	return { bridge, context: { projectId: 'project-7' }, refresh, ...extra } as unknown as Workspace;
}

/** Resolves to the rejection message, or null when the promise resolves. */
const rejection = (pending: Promise<unknown>) =>
	pending.then(
		() => null,
		(cause: Error) => cause.message
	);

const calls = (mock: unknown) => (mock as Mock).mock.calls.length;

/** A finished event for a run; a Change's summary is what the notice shows. */
const finishEvent = (runId: string) =>
	({ runId, kind: 'finished', summary: 'Change applied', verified: false }) as const;

function record(state: string, symbol: string, input: unknown, output: unknown) {
	recordExampleCases(
		{
			unitId: 'desktop.store.thread-run',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name: symbol, input, output }]
	);
}

test('starts each store idle with no run active', () => {
	const first = createThreadRunStore(workspaceStub(undefined));
	const second = createThreadRunStore(workspaceStub(undefined));
	const idle = { distinct: first !== second, runId: first.runId, status: first.status };
	const observed = {
		...idle,
		streaming: first.streaming,
		error: first.error,
		active: first.active
	};

	expect(observed).toEqual({
		distinct: true,
		runId: '',
		status: '',
		streaming: '',
		error: '',
		active: false
	});
	record('starts-each-store-idle-with-no-run-active', 'createThreadRunStore', null, observed);
});

test('start refuses a second run while one is still starting or active', async () => {
	const bridge = bridgeStub('run-1');
	const store = createThreadRunStore(workspaceStub(bridge));
	let release!: () => void;
	const gate = new Promise<void>((resolve) => (release = resolve));
	const pending = store.start(async () => {
		await gate;
		return request('plan');
	});
	const duringStart = await store.start(async () => request('plan'));
	const starting = store.active;
	release();
	const accepted = await pending;
	const duringRun = await store.start(async () => request('plan'));
	const run = {
		duringStart,
		starting,
		accepted,
		duringRun,
		runId: store.runId,
		status: store.status,
		active: store.active,
		startCalls: calls(bridge.startRun)
	};

	expect(run).toEqual({
		duringStart: false,
		starting: true,
		accepted: true,
		duringRun: false,
		runId: 'run-1',
		status: 'Request accepted',
		active: true,
		startCalls: 1
	});
	record(
		'start-refuses-a-second-run-while-one-is-still-starting-or-active',
		'start',
		{ mode: 'plan' },
		run
	);
});

test('a missing bridge is stored as an error and cancel does not reject', async () => {
	const store = createThreadRunStore(workspaceStub(undefined));
	const started = await store.start(async () => request('plan'));
	const cancelled = await rejection(store.cancel());
	const missing = {
		started,
		cancelled,
		errorName: store.error.split(':')[0],
		active: store.active
	};

	expect(missing).toEqual({
		started: false,
		cancelled: null,
		errorName: 'TypeError',
		active: false
	});
	record(
		'a-missing-bridge-is-stored-as-an-error-and-cancel-does-not-reject',
		'start, cancel',
		{ mode: 'plan' },
		missing
	);
});

test('a failed run clears its run id before a refresh rejection reaches event', async () => {
	const seen: string[] = [];
	const workspace = workspaceStub(bridgeStub('run-2'), {
		refresh: vi.fn(async () => {
			seen.push(store.runId);
			throw new Error('refresh down');
		})
	});
	const store = createThreadRunStore(workspace);
	await store.start(async () => request('plan'));
	const event = { runId: 'run-2', kind: 'failed' as const, message: 'agent stopped' };
	const failed = {
		thrown: await rejection(store.event(event)),
		refreshSawRunId: seen,
		runId: store.runId,
		error: store.error,
		active: store.active
	};

	expect(failed).toEqual({
		thrown: 'refresh down',
		refreshSawRunId: [''],
		runId: '',
		error: 'agent stopped',
		active: false
	});
	record(
		'a-failed-run-clears-its-run-id-before-a-refresh-rejection-reaches-event',
		'event',
		event,
		failed
	);
});

test('a finished Change rejects when the deployments load fails', async () => {
	const bridge = bridgeStub('run-3');
	const deployments = {
		selected: { available: true },
		environment: 'prod',
		load: vi.fn(async () => {
			throw new Error('load down');
		})
	};
	const workspace = workspaceStub(bridge, { deployments });
	const store = createThreadRunStore(workspace);
	await store.start(async () => request('change'));
	await store.event({ runId: 'run-3', kind: 'text', text: 'draft ' });
	const changed = {
		environment: bridge.startRun.mock.calls[0][0].environment,
		thrown: await rejection(store.event(finishEvent('run-3'))),
		status: store.status,
		streaming: store.streaming,
		runId: store.runId,
		refreshCalls: calls(workspace.refresh),
		loadCalls: calls(deployments.load)
	};

	expect(changed).toEqual({
		environment: 'prod',
		thrown: 'load down',
		status: 'Change applied',
		streaming: '',
		runId: '',
		refreshCalls: 1,
		loadCalls: 1
	});
	record(
		'a-finished-change-rejects-when-the-deployments-load-fails',
		'start, event',
		{ mode: 'change' },
		changed
	);
});

test('a finished Change without a deployments store skips the load and resolves', async () => {
	const bridge = bridgeStub('run-4');
	const workspace = workspaceStub(bridge);
	const store = createThreadRunStore(workspace);
	await store.start(async () => request('change'));
	await store.event({ runId: 'run-4', kind: 'text', text: 'notice text' });
	const skipped = {
		finished: await store.event(finishEvent('run-4')),
		environment: bridge.startRun.mock.calls[0][0].environment,
		status: store.status,
		streaming: store.streaming,
		runId: store.runId,
		refreshCalls: calls(workspace.refresh)
	};

	expect(skipped).toEqual({
		finished: true,
		environment: undefined,
		status: 'Change applied',
		streaming: '',
		runId: '',
		refreshCalls: 1
	});
	record(
		'a-finished-change-without-a-deployments-store-skips-the-load-and-resolves',
		'start, event',
		{ mode: 'change' },
		skipped
	);
});
