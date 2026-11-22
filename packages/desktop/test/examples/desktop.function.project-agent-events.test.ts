import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { projectAgentEvents } from '../../src/utils/explorer-ui/project-agent-events/projectAgentEvents';
import { pending } from '../../src/utils/explorer-ui/createdThread';
import type { ProjectAgent } from '../../src/lib/stores/agents-providers/projectAgent.svelte';
import type { Workspace } from '../../src/lib/stores/projects-sessions/workspace.svelte';
import type { RunEvent } from '../../src/models/development-tooling/DesktopBridge.types';

const made = {
	category: 'function',
	entityId: 'function.format-time',
	threadId: 'thread-1',
	requestSaved: true
};

/** A synthetic workspace: refresh, deployments and navigation are local stubs, never real services. */
function workspaceStub(refresh = vi.fn(async () => {})) {
	return {
		context: { projectId: 'project-a' },
		refresh,
		deployments: { load: vi.fn(async () => {}) },
		navigate: vi.fn(async (_url: string) => {}),
		path: vi.fn((category: string, id?: string) => `/${category}/${id ?? ''}`)
	};
}

function agentWith(
	workspace: ReturnType<typeof workspaceStub>,
	overrides: Partial<Record<'runId' | 'said' | 'status' | 'error', string>> = {}
) {
	// The handler clears `settle` after calling it, so the spy is also kept as `settled` to inspect.
	const settled = vi.fn((_planned: boolean) => {});
	return {
		runId: 'run-1',
		status: '',
		error: '',
		said: '',
		saved: null,
		messages: [] as Array<{ id: string; author: 'user' | 'agent'; text: string }>,
		settle: settled as ((planned: boolean) => void) | null,
		settled,
		workspace,
		...overrides
	};
}

function recordCases(state: string, cases: Parameters<typeof recordExampleCases>[1]) {
	recordExampleCases(
		{
			unitId: 'desktop.function.project-agent-events',
			symbol: 'projectAgentEvents',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

const asAgent = (value: ReturnType<typeof agentWith>) => value as unknown as ProjectAgent;
const event = (value: Record<string, unknown>) => value as RunEvent;

test('Events for another run or with no active run change nothing and resolve', async () => {
	const idle = agentWith(workspaceStub(), { runId: '' });
	const other = agentWith(workspaceStub());
	const idleResult = await projectAgentEvents(
		asAgent(idle),
		event({ runId: 'run-1', kind: 'text', text: 'ignored' })
	);
	const otherResult = await projectAgentEvents(
		asAgent(other),
		event({ runId: 'run-2', kind: 'text', text: 'ignored' })
	);
	expect(idleResult).toBeUndefined();
	expect(otherResult).toBeUndefined();
	expect(idle.said).toBe('');
	expect(other.said).toBe('');
	expect(other.workspace.refresh).not.toHaveBeenCalled();
	recordCases('ignores-events-for-another-run', [
		{ name: 'idle agent receives text', input: 'no active run', output: idleResult },
		{ name: 'other run text leaves the reply empty', input: 'run-2', output: other.said },
		{
			name: 'other run refresh calls',
			input: 'run-2',
			output: other.workspace.refresh.mock.calls.length
		}
	]);
});

test('Status, replay and text events update the streamed reply in place', async () => {
	const agent = agentWith(workspaceStub());
	await projectAgentEvents(
		asAgent(agent),
		event({ runId: 'run-1', kind: 'status', phase: 'queued', detail: 'Queued' })
	);
	await projectAgentEvents(
		asAgent(agent),
		event({ runId: 'run-1', kind: 'status', phase: 'recording', detail: 'Saving' })
	);
	await projectAgentEvents(
		asAgent(agent),
		event({ runId: 'run-1', kind: 'replay', text: 'Old', detail: 'Replayed' })
	);
	await projectAgentEvents(asAgent(agent), event({ runId: 'run-1', kind: 'text', text: ' more' }));
	const texts = agent.messages.map((message) => message.text);
	expect(agent.said).toBe('Old more');
	expect(agent.status).toBe('Replayed');
	expect(texts).toEqual(['Saving']);
	expect(agent.runId).toBe('run-1');
	recordCases('streams-status-replay-and-text', [
		{ name: 'reply after replay and text', input: ' more', output: agent.said },
		{ name: 'status after replay', input: 'replay', output: agent.status },
		{ name: 'recorded messages', input: 'recording status', output: texts }
	]);
});

test('A failed run records its reply, clears the active run and settles as not planned', async () => {
	const workspace = workspaceStub();
	const agent = agentWith(workspace, { said: 'Partial.' });
	await projectAgentEvents(
		asAgent(agent),
		event({ runId: 'run-1', kind: 'failed', message: 'Model timed out' })
	);
	const last = agent.messages.at(-1);
	expect(agent.error).toBe('Model timed out');
	expect(agent.status).toBe('');
	expect(agent.runId).toBe('');
	expect(agent.saved).toBeNull();
	expect(agent.settled).toHaveBeenCalledWith(false);
	expect(last?.text).toBe('Partial.\n\nModel timed out');
	expect(workspace.refresh).toHaveBeenCalledTimes(1);
	recordCases('failed-run-records-reply-and-clears-run', [
		{ name: 'recorded failure reply', input: 'failed event', output: last?.text },
		{ name: 'run id after failure', input: 'failed event', output: agent.runId },
		{ name: 'settled as not planned', input: 'failed event', output: false }
	]);
});

test('A cancelled run with a saved draft keeps the draft link without opening it', async () => {
	const workspace = workspaceStub();
	const agent = agentWith(workspace);
	const draft = { ...made, requestSaved: false };
	await projectAgentEvents(
		asAgent(agent),
		event({ runId: 'run-1', kind: 'cancelled', created: draft })
	);
	expect(agent.status).toBe('Cancelled. A draft was saved.');
	expect(agent.saved).toEqual(draft);
	expect(agent.settled).toHaveBeenCalledWith(false);
	expect(workspace.navigate).not.toHaveBeenCalled();
	recordCases('cancelled-run-keeps-draft-link-unopened', [
		{ name: 'status for a saved draft', input: 'cancelled event', output: agent.status },
		{ name: 'draft kept as link', input: draft, output: agent.saved },
		{ name: 'no navigation', input: draft, output: workspace.navigate.mock.calls.length }
	]);
});

test('A finished run whose request is saved opens its thread after refreshing', async () => {
	const workspace = workspaceStub();
	const agent = agentWith(workspace);
	await projectAgentEvents(
		asAgent(agent),
		event({ runId: 'run-1', kind: 'finished', summary: 'Done', verified: false, created: made })
	);
	expect(agent.status).toBe('Done');
	expect(agent.saved).toBeNull();
	expect(agent.settled).toHaveBeenCalledWith(true);
	expect(workspace.refresh).toHaveBeenCalledTimes(1);
	expect(workspace.deployments.load).toHaveBeenCalledTimes(1);
	expect(pending.get(workspace as unknown as Workspace)).toMatchObject({
		entityId: made.entityId,
		threadId: made.threadId,
		projectId: 'project-a'
	});
	expect(workspace.navigate).toHaveBeenCalledWith('/function/function.format-time');
	recordCases('finished-run-opens-saved-thread', [
		{ name: 'status from summary', input: 'finished event', output: agent.status },
		{ name: 'navigated thread path', input: made, output: workspace.navigate.mock.calls[0]?.[0] },
		{ name: 'settled as planned', input: 'finished event', output: true }
	]);
});

test('A workspace refresh failure after a terminal event rejects the promise', async () => {
	const refresh = vi.fn(async () => {
		throw new Error('refresh failed');
	});
	const workspace = workspaceStub(refresh);
	const agent = agentWith(workspace);
	let caught: unknown = null;
	try {
		await projectAgentEvents(asAgent(agent), event({ runId: 'run-1', kind: 'cancelled' }));
	} catch (error) {
		caught = error;
	}
	expect(caught).toBeInstanceOf(Error);
	expect((caught as Error).message).toBe('refresh failed');
	expect(workspace.deployments.load).not.toHaveBeenCalled();
	recordCases('refresh-failure-rejects-the-event', [
		{ name: 'propagated refresh error', input: 'cancelled event', error: caught },
		{
			name: 'deployment load calls',
			input: 'cancelled event',
			output: workspace.deployments.load.mock.calls.length
		}
	]);
});
