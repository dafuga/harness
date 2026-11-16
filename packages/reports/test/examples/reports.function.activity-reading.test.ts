import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { activityReading } from '../../src/components/projects-sessions/activity-agents/activityReading';
import { readingAge } from '../../src/utils/projects-sessions/activityReading';
import type { ActivityReading } from '../../src/utils/projects-sessions/activityReading.types';

type Roster = Parameters<typeof activityReading>[0];

const sampledAt = '2026-11-15T09:30:00.000Z';

const roster: Roster = {
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

const neverUsed: Roster = {
	tracking: 'never-used',
	working: null,
	unreadable: 0,
	roster: []
};

function summarise(reading: ActivityReading, agents: Roster) {
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

test('Working agents past their expiry leave the count', () => {
	const now = Date.parse('2026-11-15T09:31:00.000Z');
	const summary = summarise(activityReading(roster, sampledAt, now), roster);
	expect(summary.current).toBe(true);
	expect(summary.working).toBe(1);
	expect(summary.labels[1]).not.toBe(summary.labels[0]);
	recordExampleCases(
		{
			unitId: 'reports.function.activity-reading',
			symbol: 'activityReading',
			state: 'working-agents-past-their-expiry-leave-the-count',
			evidence: 'examples-cases',
			file: 'working-agents-past-their-expiry-leave-the-count.json'
		},
		[
			{
				name: 'reading exactly one minute old; contract checker expired at 09:30:20',
				input: { roster, sampledAt, now },
				output: summary
			}
		]
	);
});

test('Reading older than a minute is not current', () => {
	const sampled = '2026-11-15T09:12:00.000Z';
	const now = Date.parse(sampledAt);
	const summary = summarise(activityReading(roster, sampled, now), roster);
	expect(summary.current).toBe(false);
	expect(summary.working).toBeNull();
	expect(summary.labels[0]).toBe('Not confirmed');
	expect(summary.labels[2]).not.toBe('Not confirmed');
	recordExampleCases(
		{
			unitId: 'reports.function.activity-reading',
			symbol: 'activityReading',
			state: 'reading-older-than-a-minute-is-not-current',
			evidence: 'examples-cases',
			file: 'reading-older-than-a-minute-is-not-current.json'
		},
		[
			{
				name: 'reading sampled 18 minutes before now; working agent is not confirmed',
				input: { roster, sampledAt: sampled, now },
				output: summary
			}
		]
	);
});

test('Never-used tracking reports no working count', () => {
	const now = Date.parse(sampledAt);
	const summary = summarise(activityReading(neverUsed, sampledAt, now), neverUsed);
	expect(summary.current).toBe(true);
	expect(summary.working).toBeNull();
	expect(summary.labels).toEqual([]);
	recordExampleCases(
		{
			unitId: 'reports.function.activity-reading',
			symbol: 'activityReading',
			state: 'never-used-tracking-reports-no-working-count',
			evidence: 'examples-cases',
			file: 'never-used-tracking-reports-no-working-count.json'
		},
		[
			{
				name: 'tracking never used; current reading has an empty roster',
				input: { roster: neverUsed, sampledAt, now },
				output: summary
			}
		]
	);
});

test('Reading age allowance is one minute', () => {
	expect(readingAge).toBe(60000);
	recordExampleCases(
		{
			unitId: 'reports.function.activity-reading',
			symbol: 'readingAge',
			state: 'reading-age-allowance-is-one-minute',
			evidence: 'examples-cases',
			file: 'reading-age-allowance-is-one-minute.json'
		},
		[{ name: 'freshness allowance constant', input: {}, output: readingAge }]
	);
});

test('Unparseable sample time is not current', () => {
	const now = Date.parse(sampledAt);
	const summary = summarise(activityReading(roster, 'not-a-time', now), roster);
	expect(summary.current).toBe(false);
	expect(summary.working).toBeNull();
	recordExampleCases(
		{
			unitId: 'reports.function.activity-reading',
			symbol: 'activityReading',
			state: 'unparseable-sample-time-is-not-current',
			evidence: 'examples-cases',
			file: 'unparseable-sample-time-is-not-current.json'
		},
		[
			{
				name: 'sample time Date.parse cannot read',
				input: { roster, sampledAt: 'not-a-time', now },
				output: summary
			}
		]
	);
});
