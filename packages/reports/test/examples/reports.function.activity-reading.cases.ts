import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { activityReading } from '../../src/components/projects-sessions/activity-agents/activityReading';
import type { ActivityReading } from '../../src/utils/projects-sessions/activityReading.types';
import type { Roster } from './reports.function.activity-reading.test.types';

export const sampledAt = '2026-11-15T09:30:00.000Z';

export const roster: Roster = {
	tracking: 'available',
	working: 2,
	unreadable: 0,
	roster: [
		{
			id: 'c0a4e7d1-7f3b-4d92-b5e8-16a9c3f2d074',
			label: 'Reports reader',
			provider: 'anthropic',
			model: 'claude-haiku-5-5',
			worktree: 'slot-07',
			branch: 'p1-contracts-a',
			task: 'Write the activity-freshness contract',
			loop: 'contract-pass-1',
			units: ['reports.function.activity-reading'],
			unknownUnits: [],
			registeredAt: '2026-11-15T08:55:12.418Z',
			heartbeatAt: '2026-11-15T09:29:40.102Z',
			expiresAt: '2026-11-15T09:44:40.102Z',
			state: 'working',
			detail: 'Last heartbeat at 2026-11-15T09:29:40.102Z'
		},
		{
			id: '5b1e9f0c-2d4a-4c7e-9a3f-8e6d1b2c7f40',
			label: 'Contract checker',
			provider: 'anthropic',
			model: 'claude-sonnet-5-5',
			worktree: 'slot-11',
			branch: 'p1-contracts-b',
			task: 'Check the unit contracts',
			loop: 'contract-pass-2',
			units: ['reports.function.activity-display'],
			unknownUnits: [],
			registeredAt: '2026-11-15T09:10:03.770Z',
			heartbeatAt: '2026-11-15T09:25:20.000Z',
			expiresAt: '2026-11-15T09:30:20.000Z',
			state: 'working',
			detail: 'Last heartbeat at 2026-11-15T09:25:20.000Z'
		},
		{
			id: 'pyramid-checker-2',
			label: 'Pyramid checker',
			provider: null,
			model: null,
			worktree: 'slot-03',
			branch: 'main',
			task: null,
			loop: null,
			units: [],
			unknownUnits: [],
			registeredAt: '2026-11-15T07:02:44.915Z',
			heartbeatAt: '2026-11-15T09:12:08.333Z',
			expiresAt: '2026-11-15T09:27:08.333Z',
			state: 'completed',
			detail: 'Finished at 2026-11-15T09:14:51.007Z',
			finishedAt: '2026-11-15T09:14:51.007Z',
			outcome: 'All three contracts were checked.'
		}
	]
};

export function summarise(reading: ActivityReading, agents: Roster) {
	return {
		current: reading.current,
		working: reading.working,
		labels: agents.roster.map((agent) => reading.label(agent))
	};
}

test('Reading within a minute keeps every working agent', () => {
	const now = Date.parse(sampledAt);
	const summary = summarise(activityReading(roster, sampledAt, now), roster);
	expect(summary.current).toBe(true);
	expect(summary.working).toBe(2);
	expect(summary.labels[0]).toBe(summary.labels[1]);
	expect(summary.labels[0]).not.toBe('Not confirmed');
	expect(summary.labels[2]).not.toBe('Not confirmed');
	recordExampleCases(
		{
			unitId: 'reports.function.activity-reading',
			symbol: 'activityReading',
			state: 'reading-within-a-minute-keeps-every-working-agent',
			evidence: 'examples-cases',
			file: 'reading-within-a-minute-keeps-every-working-agent.json'
		},
		[
			{
				name: 'roster sampled at the moment it is read; both working agents unexpired',
				input: { roster, sampledAt, now },
				output: summary
			}
		]
	);
});
