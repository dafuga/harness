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
		priority: 'normal',
		kind: 'task',
		title,
		status: 'open',
		stage: 'idea',
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
	question: 'Approve?',
	asked_at: UPDATED,
	waiting_minutes: 2730
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

test('digest returns counts, unanswered asks and the configured local day', () => {
	fixture.database.exec('PRAGMA query_only = ON');
	expect(fixture.repository.digest(NOW)).toEqual({
		generated_at: '2026-07-01T23:30:00.000Z',
		local_time: '2026-07-02 00:30 Europe/Lisbon',
		today: '2026-07-02',
		blocked: [blocked],
		needs_daniel: [
			blocked,
			summary('abc200', 'Done item', {
				status: 'done',
				needs_daniel: true,
				due: '2026-06-28',
				asked_at: UPDATED,
				waiting_minutes: 2730
			})
		],
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
		queued: [],
		chased_7d: [],
		counts: {
			blocked: 1,
			needs_daniel: 2,
			overdue: 2,
			due_today: 3,
			recurring_missed: 1,
			queued: 0,
			chased_7d: 0
		}
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
			'  - [abc100] Blocked item - blocked: Needs a plan; NEEDS DANIEL · waiting 45h 30m; due 2026-06-30 (task; owner operator, agent fixture-agent; priority normal; idea)',
			'NEEDS DANIEL (1)',
			'  - [abc200] Done item - waiting 45h 30m (task; agent fixture-agent; priority normal; idea)',
			'QUEUED (0)',
			'  (none)',
			'Chased (7d) (0)',
			'  (none)',
			'OVERDUE (1)',
			'  - [abc400] Resolved item - due 2026-06-30 (task; agent fixture-agent; priority normal; idea)',
			'DUE TODAY (3)',
			'  - [abc100] Timestamp today - due 2026-07-01T23:15:00.000Z (task; owner operator, agent fixture-agent; priority normal; idea)',
			'  - [def100] Date today (plan; agent fixture-agent; priority normal; idea)',
			'  - [xyz100] Later today - due 2026-07-02T03:00:00.000Z (task; agent fixture-agent; priority normal; idea)',
			'RECURRING: MISSED OR FAILED (1)',
			"  - [def200] Missed and failed - missed 2026-06-29 08:00; failed 2026-06-30 08:00: fixture failed; every '0 12 * * *' (recurring; agent fixture-agent; priority normal; idea)"
		].join('\n')
	);
});
