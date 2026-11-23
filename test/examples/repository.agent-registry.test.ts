import type { Registration, Beat, End } from './repository.agent-registry.test.types';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { AgentRegistryRepository } from '../../src/services/agents-providers/agent-activity-service/AgentRegistryRepository';

const meta = (symbol: string, state: string) => ({
	unitId: 'repository.agent-registry',
	symbol,
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

const registration = (id: string): Registration => ({
	schemaVersion: 1,
	id,
	label: `Agent ${id}`,
	provider: 'openai',
	model: 'gpt-6-luna',
	pid: 48217,
	processStartedAt: '2026-11-14T10:15:00.000Z',
	registeredAt: '2026-11-14T10:16:00.000Z',
	ttlSeconds: 120
});

const heartbeat = (task: string): Beat => ({
	at: '2026-11-14T10:18:00.000Z',
	branch: 'feature/agent-registry',
	task,
	loop: 'implementation',
	units: ['repository.agent-registry', 'function.activity-types']
});

const completedEnd: End = {
	at: '2026-11-14T10:45:00.000Z',
	status: 'completed',
	outcome: 'Contract updated'
};

const failedEnd: End = { at: '2026-11-14T10:50:00.000Z', status: 'failed', outcome: null };

test('Registers an agent and reads it back', async () => {
	await withTempDir('agent-registry-register-', async (root) => {
		const repository = new AgentRegistryRepository(root);
		const before = repository.used();
		await repository.register(
			registration('agent-frontend-a'),
			heartbeat('Update the agent registry contract')
		);
		const stored = await repository.read('agent-frontend-a');

		expect(before).toBe(false);
		expect(repository.used()).toBe(true);
		expect(stored?.registration.label).toBe('Agent agent-frontend-a');
		expect(stored?.end).toBeNull();
		recordExampleCases(meta('register', 'registers-an-agent-and-reads-it-back'), [
			{ name: 'checkout with no agent state is not used', input: { root: 'empty' }, output: before },
			{
				name: 'registers agent-frontend-a then reads it back',
				input: { id: 'agent-frontend-a', task: 'Update the agent registry contract' },
				output: stored
			}
		]);
	});
});

test('Keeps the first end an agent writes', async () => {
	await withTempDir('agent-registry-finish-', async (root) => {
		const repository = new AgentRegistryRepository(root);
		await repository.register(registration('agent-frontend-a'), heartbeat('Update the contract'));
		const first = await repository.finish('agent-frontend-a', completedEnd);
		const second = await repository.finish('agent-frontend-a', failedEnd);
		const stored = await repository.read('agent-frontend-a');

		expect(first).toBe(true);
		expect(second).toBe(false);
		expect(stored?.end).toEqual(completedEnd);
		recordExampleCases(meta('finish', 'keeps-the-first-end-an-agent-writes'), [
			{
				name: 'first end is written',
				input: { id: 'agent-frontend-a', status: 'completed' },
				output: first
			},
			{
				name: 'second end is refused because the first stands',
				input: { id: 'agent-frontend-a', status: 'failed' },
				output: second
			},
			{ name: 'read keeps the completed end', input: { id: 'agent-frontend-a' }, output: stored?.end }
		]);
	});
});

test('Replaces the heartbeat of a registered agent', async () => {
	await withTempDir('agent-registry-beat-', async (root) => {
		const repository = new AgentRegistryRepository(root);
		await repository.register(registration('agent-frontend-a'), heartbeat('First task'));
		await repository.beat('agent-frontend-a', heartbeat('Second task'));
		const stored = await repository.read('agent-frontend-a');

		let missing: unknown;
		try {
			await repository.beat('agent-missing', heartbeat('Unregistered task'));
		} catch (caught) {
			missing = caught;
		}

		expect(stored?.beat.task).toBe('Second task');
		expect((missing as { code?: string }).code).toBe('ENOENT');
		recordExampleCases(meta('beat', 'replaces-the-heartbeat-of-a-registered-agent'), [
			{
				name: 'beat replaces the latest heartbeat',
				input: { id: 'agent-frontend-a', task: 'Second task' },
				output: stored?.beat
			},
			{
				name: 'beat for an unregistered agent rejects without creating its directory',
				input: { id: 'agent-missing', task: 'Unregistered task' },
				error: { code: (missing as { code?: string }).code }
			}
		]);
	});
});

test('Lists registered agents and counts unreadable ones', async () => {
	await withTempDir('agent-registry-all-', async (root) => {
		const repository = new AgentRegistryRepository(root);
		const agents = join(root, '.cache', 'harness', 'agents');
		await repository.register(registration('agent-b'), heartbeat('Second'));
		await repository.register(registration('agent-a'), heartbeat('First'));
		await writeFile(join(agents, 'agent-b', 'heartbeat.json'), '{not json');
		await mkdir(join(agents, 'agent-empty'));
		const listing = await repository.all();

		expect(listing.agents.map((agent) => agent.registration.id)).toEqual(['agent-a']);
		expect(listing.unreadable).toBe(1);
		recordExampleCases(meta('all', 'lists-registered-agents-and-counts-unreadable-ones'), [
			{
				name: 'lists readable agents and counts the damaged heartbeat',
				input: { entries: ['agent-a', 'agent-b', 'agent-empty'] },
				output: {
					agents: listing.agents.map((agent) => agent.registration.id),
					unreadable: listing.unreadable
				}
			}
		]);
	});
});
