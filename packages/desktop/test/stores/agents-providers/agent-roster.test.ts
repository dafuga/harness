import { afterEach, expect, test, vi } from 'vitest';
import { createAgentRosterStore } from '../../../src/lib/stores/agents-providers/agentRoster.svelte';
import type { Workspace } from '../../../src/lib/stores/projects-sessions/workspace.svelte';
import type { AgentEntry } from '../../../../../src/core/activityTypes';

const agent = (id: string, units: string[], state = 'working') =>
	({
		id,
		label: id,
		task: 'Task',
		units,
		state,
		expiresAt: new Date(Date.now() + 900_000).toISOString()
	}) as AgentEntry;
function fixture() {
	const entries = [
		agent('A', ['component.card', 'component.card']),
		agent('B', ['component.card']),
		agent('C', ['page.old'], 'stale')
	];
	const value = {
		sampledAt: new Date().toISOString(),
		agents: { tracking: 'available' as const, working: 2, unreadable: 0, roster: entries }
	};
	const read = vi.fn(async (_input: unknown) => value);
	const workspace = { projectId: 'local-a', bridge: { agentActivity: read } };
	return {
		value,
		read,
		workspace,
		state: createAgentRosterStore(workspace as unknown as Workspace)
	};
}
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

test('declared assignments group actual owners, remove duplicate units and omit stale work', async () => {
	const f = fixture();
	await f.state.refresh();
	expect(f.read).toHaveBeenCalledWith({ projectId: 'local-a' });
	expect(f.state.working).toBe(2);
	expect(f.state.modules.map((row) => [row.id, row.owners.map((owner) => owner.id)])).toEqual([
		['component.card', ['A', 'B']]
	]);
	expect(f.state.sessions.at(-1)?.label).toBe('Stale');
});

test('a missed refresh retains its reading, then expires its claims of current work', async () => {
	vi.useFakeTimers();
	const f = fixture();
	await f.state.refresh();
	f.read.mockRejectedValue(new Error('offline'));
	await f.state.refresh();
	expect(f.state.error).toContain('last reading');
	expect(f.state.sample).toEqual(f.value);
	vi.setSystemTime(Date.now() + 61_000);
	vi.stubGlobal('document', {
		visibilityState: 'visible',
		addEventListener() {},
		removeEventListener() {}
	});
	const stop = f.state.listen();
	await vi.advanceTimersByTimeAsync(15_000);
	expect(f.state.working).toBeNull();
	expect(f.state.modules).toEqual([]);
	expect(f.state.sessions[0].label).toBe('Not confirmed');
	stop();
});

test('missing readers and never-used tracking mean unknown rather than zero', async () => {
	const f = fixture();
	f.value.agents.working = null as unknown as number;
	f.value.agents.tracking = 'never-used' as 'available';
	f.value.agents.roster = [];
	await f.state.refresh();
	expect(f.state.working).toBeNull();
	const unsupported = createAgentRosterStore({
		projectId: 'hosted',
		bridge: {}
	} as unknown as Workspace);
	await unsupported.refresh();
	expect(unsupported.sample).toBeNull();
	expect(unsupported.error).toContain('unavailable');
});

test('project switches and closed panels reject late readings and stop polling', async () => {
	vi.useFakeTimers();
	const f = fixture();
	let arrive!: (value: typeof f.value) => void;
	f.read.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				arrive = resolve;
			})
	);
	const reading = f.state.refresh();
	f.workspace.projectId = 'local-b';
	arrive(f.value);
	await reading;
	expect(f.state.sample).toBeNull();
	expect(f.state.sessions).toEqual([]);
	const add = vi.fn(),
		remove = vi.fn();
	vi.stubGlobal('document', {
		visibilityState: 'visible',
		addEventListener: add,
		removeEventListener: remove
	});
	f.read.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				arrive = resolve;
			})
	);
	const stop = f.state.listen();
	stop();
	arrive(f.value);
	await Promise.resolve();
	await vi.advanceTimersByTimeAsync(45_000);
	expect(f.state.sample).toBeNull();
	expect(f.read).toHaveBeenCalledTimes(2);
	expect(remove).toHaveBeenCalledWith('visibilitychange', add.mock.calls[0][1]);
});
