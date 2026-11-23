import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { createAgentRosterStore } from '../../src/lib/stores/agents-providers/agentRoster.svelte';
import type { Sample } from '../../src/lib/stores/agents-providers/agentRoster.svelte.types';
import type { Workspace } from '../../src/lib/stores/projects-sessions/workspace.svelte.types';

function sample(): Sample {
	const now = Date.now();
	return {
		sampledAt: new Date(now).toISOString(),
		agents: {
			tracking: 'available',
			working: 1,
			unreadable: 0,
			roster: [
				{
					id: 'agent-1',
					label: 'Builder',
					provider: 'local',
					model: 'example-model',
					worktree: 'main',
					branch: 'feature/roster',
					task: 'Update the roster',
					loop: null,
					units: ['desktop.store.agents-providers-agent-roster'],
					unknownUnits: [],
					registeredAt: new Date(now - 120_000).toISOString(),
					heartbeatAt: new Date(now).toISOString(),
					expiresAt: new Date(now + 60_000).toISOString(),
					state: 'working',
					detail: 'Editing the agent roster'
				}
			]
		}
	};
}

test('refreshes the selected project roster and derives active assignments', async () => {
	const reading = sample();
	const workspace = {
		projectId: 'project-alpha',
		bridge: { agentActivity: async () => reading }
	} as unknown as Workspace;
	const store = createAgentRosterStore(workspace);
	await store.refresh();
	const result = {
		working: store.working,
		sessions: store.sessions.map(({ agent, label }) => ({ id: agent.id, label })),
		modules: store.modules.map(({ id, owners }) => ({
			id,
			owners: owners.map(({ id: owner }) => owner)
		})),
		error: store.error
	};
	expect(store.sample).toEqual(reading);
	expect(result).toMatchObject({
		working: 1,
		sessions: [{ id: 'agent-1', label: 'Working' }],
		modules: [{ id: 'desktop.store.agents-providers-agent-roster', owners: ['agent-1'] }],
		error: ''
	});
	recordExampleCases(
		{
			unitId: 'desktop.store.agents-providers-agent-roster',
			symbol: 'refresh',
			state: 'refreshes-the-selected-project-roster-and-derives-active-ass',
			evidence: 'examples-cases',
			file: 'refreshes-the-selected-project-roster-and-derives-active-ass.json'
		},
		[
			{
				name: 'refresh project-alpha agent activity',
				input: { projectId: 'project-alpha' },
				output: {
					working: result.working,
					sessions: result.sessions,
					modules: result.modules,
					error: result.error
				}
			}
		]
	);
});
