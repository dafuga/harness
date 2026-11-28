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

const choices = [
	{ label: 'Approve', effect: '', recommended: true as const },
	{ label: 'Hold', effect: '' }
];

beforeEach(() => {
	fixture = trackerReadFixture();
	// One open flag is a structured ask; the finished item's flag offers no choices.
	fixture.database
		.prepare("UPDATE items SET options = ? WHERE id = 'abc100'")
		.run(JSON.stringify(choices));
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
	options: choices,
	asked_at: UPDATED,
	waiting_minutes: 2730
});

const doneItem = summary('abc200', 'Done item', {
	status: 'done',
	needs_daniel: true,
	due: '2026-06-28',
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

const fixtureProject = {
	project: 'fixture-agent',
	in_progress: 1,
	blocked: 1,
	open: 7,
	phase4_workers: { total: 0, in_progress: 0, blocked: 0, open: 0 },
	eta: { id: 'def100', due: '2026-07-02', overdue: false },
	latest_note: { id: 'abc100more', at: '1970-01-01T00:00:03.000Z', text: 'Other item note' }
};

test('digest returns counts, unanswered asks and the configured local day', () => {
	fixture.database.exec('PRAGMA query_only = ON');
	expect(fixture.repository.digest(NOW)).toEqual({
		generated_at: '2026-07-01T23:30:00.000Z',
		local_time: '2026-07-02 00:30 Europe/Lisbon',
		today: '2026-07-02',
		blocked: [blocked],
		needs_daniel: [blocked, doneItem],
		overdue: [blocked, summary('abc400', 'Resolved item', { due: '2026-06-30' })],
		due_today: [
			summary('abc100more', 'Timestamp today', {
				due: '2026-07-01T23:15:00.000Z',
				owner: 'operator'
			}),
			summary('def100', 'Date today', { kind: 'plan', status: 'in_progress', due: '2026-07-02' }),
			summary('xyz100', 'Later today', { due: '2026-07-02T03:00:00.000Z' })
		],
		daniel_decisions: [blocked],
		needs_options: [doneItem],
		pings: [],
		projects: [fixtureProject],
		to_unblock: [blocked],
		recurring_missed: [problem],
		queued: [],
		launch_holds: [],
		chased_7d: [],
		counts: {
			blocked: 1,
			needs_daniel: 2,
			daniel_decisions: 1,
			needs_options: 1,
			pings: 0,
			stale_decisions: 1,
			overdue: 2,
			due_today: 3,
			recurring_missed: 1,
			queued: 0,
			launch_holds: 0,
			chased_7d: 0,
			projects: 1,
			to_unblock: 1
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
			'PROJECTS (1)',
			'  - fixture-agent: 1 in progress, 1 blocked, 7 open · ETA 2026-07-02 [def100] · latest 1970-01-01 [abc100]: Other item note',
			'BLOCKED (1)',
			'  - [abc100] Blocked item - blocked: Needs a plan; NEEDS DANIEL · waiting 45h 30m; due 2026-06-30 (task; owner operator, agent fixture-agent; priority normal; idea)',
			'NEEDS OPTIONS (1; for Chief of Staff, not shown to Daniel)',
			'  - [abc200] Done item - STALE 1d 21h old; ITEM DONE, FLAG STILL OPEN (task; agent fixture-agent; priority normal; idea)',
			'CoS/WORKER PINGS (0)',
			'  (none)',
			'QUEUED (0)',
			'  (none)',
			'AUTOMATIC LAUNCH HOLDS (0)',
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
			"  - [def200] Missed and failed - missed 2026-06-29 08:00; failed 2026-06-30 08:00: fixture failed; every '0 12 * * *' (recurring; agent fixture-agent; priority normal; idea)",
			'To unblock (Daniel) (1; oldest first; 24h+ is STALE)',
			'  - [abc100] Blocked item - Q: Approve? (STALE 1d 21h old)'
		].join('\n')
	);
});
