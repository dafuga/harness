import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { activityReading } from '../../src/components/projects-sessions/activity-agents/activityReading';
import { readingAge } from '../../src/utils/projects-sessions/activityReading';
import type { Roster } from './reports.function.activity-reading.test.types';
import { summarise, roster, sampledAt } from './reports.function.activity-reading.cases';

const neverUsed: Roster = {
	tracking: 'never-used',
	working: null,
	unreadable: 0,
	roster: []
};

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
