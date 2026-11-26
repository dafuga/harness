import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { createProjectAgentStore } from '../../src/lib/stores/agents-providers/projectAgent.svelte';
import type { Workspace } from '../../src/lib/stores/projects-sessions/workspace.svelte';
import type { RunEvent } from '../../src/models/development-tooling/DesktopBridge.types';
import { projectAgentActions } from '../../src/utils/agents-providers/projectAgentActions';
import type { RunDraft } from '../../src/utils/explorer-ui/composeModes.types';
import type { Cases } from './desktop.function.project-agent-actions.test.types';

const unitId = 'desktop.function.project-agent-actions';

export const planDraft: RunDraft = {
	mode: 'plan',
	provider: 'codex',
	model: 'synthetic-model',
	effort: null,
	text: 'Plan a settings panel'
};

/** A synthetic project agent with stub transports; nothing here reaches a model or a network. */
export function fixture(change: Record<string, unknown> = {}) {
	let follow: (event: RunEvent) => void = () => {};
	const bridge = {
		providers: vi.fn(async () => []),
		startRun: vi.fn(async (_request: unknown) => ({ runId: 'run-1' })),
		addComment: vi.fn(async (_input: unknown): Promise<unknown> => ({ kind: 'shared' })),
		cancelRun: vi.fn(async (_input: unknown) => {}),
		onRunEvent: (listener: (event: RunEvent) => void) => {
			follow = listener;
			return () => {};
		}
	};
	const workspace = {
		bridge,
		category: 'functions',
		pinned: false,
		busy: false,
		error: '',
		capabilities: { agents: true, comments: true, reason: '' },
		snapshot: { writable: true, revision: { branch: 'main', commit: 'abc123' } },
		projectId: 'local-1',
		context: { projectId: 'local-1' },
		refresh: vi.fn(async () => {}),
		navigate: vi.fn(async (_path: string) => {}),
		path: (category: string, id: string) => `/${category}/${id}`,
		...change
	};
	const agent = createProjectAgentStore(workspace as unknown as Workspace);
	agent.listen();
	const finish = () =>
		follow({ runId: 'run-1', kind: 'finished', summary: 'Done.', verified: false });
	return { agent, bridge, finish };
}

export function recordCases(symbol: string, state: string, cases: Cases) {
	const file = `${state}.json`;
	recordExampleCases({ unitId, symbol, state, evidence: 'examples-cases', file }, cases);
}

test('Refuses to start when the agent is busy, disallowed or has no project', async () => {
	const cases: Cases = [];
	const disallowed = fixture({ capabilities: { agents: false, comments: true, reason: '' } });
	const unbound = fixture({ projectId: null });
	const busy = fixture();
	busy.agent.runId = 'run-0';
	for (const [name, f] of [
		['agents capability withheld', disallowed],
		['no project id', unbound],
		['run already active', busy]
	] as const) {
		const result = await projectAgentActions(f.agent, planDraft);
		cases.push({
			name,
			input: planDraft,
			output: { result, startRuns: f.bridge.startRun.mock.calls.length }
		});
	}
	expect(cases.map(({ output }) => output)).toEqual(
		Array.from({ length: 3 }, () => ({ result: false, startRuns: 0 }))
	);
	recordCases('projectAgentActions', 'refuses-to-start-when-busy-disallowed-or-no-project', cases);
});
