import { afterEach, beforeEach, expect, test } from 'vitest';
import type { TrackerDigestItem } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository.types';
import {
	insertItem,
	MISSED,
	NOW,
	OCCURRENCE,
	trackerReadFixture,
	UPDATED
} from './trackerItemReadFixture';

let fixture: ReturnType<typeof trackerReadFixture>;

beforeEach(() => {
	fixture = trackerReadFixture();
});

afterEach(() => fixture.database.close());

function summary(
	id: string,
	title: string,
	fields: Partial<TrackerDigestItem> = {}
): TrackerDigestItem {
	return {
		id,
		kind: 'task',
		title,
		status: 'open',
		blocked_reason: null,
		needs_daniel: false,
		due: null,
		owner: null,
		agent: 'fixture-agent',
		question: null,
		created_by: 'fixture-author',
		updated_at: UPDATED,
		...fields
	};
}

const blocked = summary('abc100', 'Blocked item', {
	status: 'blocked',
	blocked_reason: 'Needs a plan',
	needs_daniel: true,
	due: '2026-06-30',
	owner: 'operator',
	question: 'Approve?'
});

const problem = {
	...summary('def200', 'Missed and failed', { kind: 'recurring', due: '2026-07-01' }),
	every: '0 12 * * *',
	every_tz: 'America/New_York',
	missed: MISSED,
	missed_local: '2026-06-29 08:00',
	failed: { occurrence: OCCURRENCE, note: 'fixture failed' },
	failed_local: '2026-06-30 08:00'
};

test('digest returns the full legacy groups and counts using the configured local day', () => {
	fixture.database.exec('PRAGMA query_only = ON');
	expect(fixture.repository.digest(NOW)).toEqual({
		generated_at: '2026-07-01T23:30:00.000Z',
		local_time: '2026-07-02 00:30 Europe/Lisbon',
		today: '2026-07-02',
		blocked: [blocked],
		needs_daniel: [blocked],
		overdue: [blocked, summary('abc400', 'Resolved item', { due: '2026-06-30' })],
		due_today: [
			summary('abc100more', 'Timestamp today', {
				due: '2026-07-01T23:15:00.000Z',
				owner: 'operator'
			}),
			summary('def100', 'Date today', { kind: 'plan', status: 'in_progress', due: '2026-07-02' }),
			summary('xyz100', 'Later today', { due: '2026-07-02T03:00:00.000Z' })
		],
		recurring_missed: [problem],
		counts: { blocked: 1, needs_daniel: 1, overdue: 2, due_today: 3, recurring_missed: 1 }
	});
	const utc = fixture.repository.digest(NOW, 'UTC');
	expect(utc.local_time).toBe('2026-07-01 23:30 UTC');
	expect(utc.due_today.map(({ id }) => id)).toEqual(['abc100more']);
});

test('digest keeps an unacknowledged miss with corrupt result metadata and resolves display time', () => {
	insertItem(fixture.database, {
		id: 'corrupt-result',
		title: 'Unacknowledged miss',
		kind: 'recurring',
		every: '0 12 * * *',
		missed: MISSED,
		last_result: '{'
	});
	expect(fixture.repository.digest(NOW, 'UTC').recurring_missed).toEqual([
		problem,
		{
			...summary('corrupt-result', 'Unacknowledged miss', { kind: 'recurring' }),
			every: '0 12 * * *',
			every_tz: 'Europe/Lisbon',
			missed: MISSED,
			missed_local: '2026-06-29 12:00',
			failed: null,
			failed_local: null
		}
	]);
});

test('digestText renders legacy section order and omits blocked rows from other due or flag sections', () => {
	expect(fixture.repository.digestText(NOW)).toBe(
		[
			'Tracker digest - 2026-07-02 00:30 Europe/Lisbon',
			'BLOCKED (1)',
			'  - [abc100] Blocked item - blocked: Needs a plan; NEEDS DANIEL; due 2026-06-30 (task; owner operator, agent fixture-agent)',
			'NEEDS DANIEL (0)',
			'  (none)',
			'OVERDUE (1)',
			'  - [abc400] Resolved item - due 2026-06-30 (task; agent fixture-agent)',
			'DUE TODAY (3)',
			'  - [abc100] Timestamp today - due 2026-07-01T23:15:00.000Z (task; owner operator, agent fixture-agent)',
			'  - [def100] Date today (plan; agent fixture-agent)',
			'  - [xyz100] Later today - due 2026-07-02T03:00:00.000Z (task; agent fixture-agent)',
			'RECURRING: MISSED OR FAILED (1)',
			"  - [def200] Missed and failed - missed 2026-06-29 08:00; failed 2026-06-30 08:00: fixture failed; every '0 12 * * *' (recurring; agent fixture-agent)"
		].join('\n')
	);
});
