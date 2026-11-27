import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { createThreadRunStore } from '../../src/lib/stores/development-tooling/threadRun.svelte';
import type { Workspace } from '../../src/lib/stores/projects-sessions/workspace.svelte';

/** Synthetic workspace: only the fields the store reads, with refresh stubbed. */
export function workspaceStub(bridge: unknown, extra: Record<string, unknown> = {}) {
	const refresh = vi.fn(async () => undefined);
	return { bridge, context: { projectId: 'project-7' }, refresh, ...extra } as unknown as Workspace;
}

export function record(state: string, symbol: string, input: unknown, output: unknown) {
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
