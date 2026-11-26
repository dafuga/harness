import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { createProjectAgentStore } from '../../src/lib/stores/agents-providers/projectAgent.svelte';
import type { Workspace } from '../../src/lib/stores/projects-sessions/workspace.svelte.types';

export const PROJECT = 'project-alpha';

/** A synthetic bridge: every method is a spy, no transport or model is reached. */
export function syntheticBridge() {
	return {
		providers: vi.fn(async () => [{ id: 'local', label: 'Local', models: ['example-model'] }]),
		onRunEvent: vi.fn(() => vi.fn()),
		startRun: vi.fn(async () => ({ runId: 'run-1' })),
		cancelRun: vi.fn(async () => undefined),
		addComment: vi.fn(async () => ({ kind: 'shared' }))
	};
}

/** A writable tip of an agent-capable project; overrides turn it into other states. */
export function workspaceWith(
	bridge: ReturnType<typeof syntheticBridge> | undefined,
	overrides: Record<string, unknown> = {}
) {
	return {
		projectId: PROJECT,
		busy: false,
		error: '',
		pinned: false,
		snapshot: { writable: true, revision: { branch: 'main', commit: 'abc123' } },
		capabilities: { agents: true, comments: true },
		bridge,
		context: { projectId: PROJECT },
		...overrides
	} as unknown as Workspace;
}

export function recordCases(state: string, cases: Parameters<typeof recordExampleCases>[1]) {
	recordExampleCases(
		{
			unitId: 'desktop.store.project-agent',
			symbol: 'projectAgent',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Creates an idle store per call and makes no bridge call until a method runs', () => {
	const bridge = syntheticBridge();
	const workspace = workspaceWith(bridge);
	const first = createProjectAgentStore(workspace);
	const second = createProjectAgentStore(workspace);
	const initial = {
		runId: first.runId,
		status: first.status,
		error: first.error,
		asked: first.asked,
		said: first.said,
		saved: first.saved,
		providers: first.providers,
		messages: first.messages,
		starting: first.starting,
		active: first.active
	};
	expect(first).not.toBe(second);
	expect(initial).toEqual({
		runId: '',
		status: '',
		error: '',
		asked: '',
		said: '',
		saved: null,
		providers: [],
		messages: [],
		starting: false,
		active: false
	});
	expect(second.runId).toBe('');
	expect(bridge.providers).not.toHaveBeenCalled();
	expect(bridge.onRunEvent).not.toHaveBeenCalled();
	expect(bridge.startRun).not.toHaveBeenCalled();
	recordCases('creates-idle-stores-and-makes-no-bridge-calls-until-used', [
		{
			name: 'create two stores over one workspace',
			input: { projectId: PROJECT },
			output: { distinct: first !== second, initial }
		},
		{
			name: 'bridge calls after creation',
			input: { bridge: 'synthetic' },
			output: {
				providers: bridge.providers.mock.calls.length,
				onRunEvent: bridge.onRunEvent.mock.calls.length
			}
		}
	]);
});
