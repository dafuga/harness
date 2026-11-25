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
		daniel_decisions: [blocked, doneItem],
		pings: [],
		projects: [fixtureProject],
		to_unblock: [blocked, doneItem],
		recurring_missed: [problem],
		queued: [],
		chased_7d: [],
		counts: {
			blocked: 1,
			needs_daniel: 2,
			daniel_decisions: 2,
			pings: 0,
			stale_decisions: 2,
			overdue: 2,
			due_today: 3,
			recurring_missed: 1,
			queued: 0,
			chased_7d: 0,
			projects: 1,
			to_unblock: 2
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
			'CoS/WORKER PINGS (0)',
			'  (none)',
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
			"  - [def200] Missed and failed - missed 2026-06-29 08:00; failed 2026-06-30 08:00: fixture failed; every '0 12 * * *' (recurring; agent fixture-agent; priority normal; idea)",
			'To unblock (Daniel) (2; oldest first; 24h+ is STALE)',
			'  - [abc100] Blocked item - Q: Approve? (STALE 1d 21h old)',
			'  - [abc200] Done item - open flag (STALE 1d 21h old; ITEM DONE, FLAG STILL OPEN)'
		].join('\n')
	);
});

test('pings are separate from Daniel decisions, collapsed, and never hide an old decision', () => {
	const ping = (id: string, hours: number) =>
		insertItem(fixture.database, {
			id,
			title: `Worker ${id}`,
			status: 'in_progress',
			needs_daniel: 1,
			question: `daniel-primary-mbp: Session auto-${id}-r1 is idle again after a watchdog check-in. Chief of Staff, please inspect the session.`,
			clocks: JSON.stringify({
				needs_daniel: `${String(NOW - hours * 3_600_000).padStart(15, '0')}-000000-n`
			})
		});
	for (const [index, id] of ['pa0001', 'pa0002', 'pa0003', 'pa0004', 'pa0005', 'pa0006'].entries())
		ping(id, index);
	const digest = fixture.repository.digest(NOW);
	expect(digest.pings.map(({ id }) => id)).toEqual([
		'pa0006',
		'pa0005',
		'pa0004',
		'pa0003',
		'pa0002',
		'pa0001'
	]);
	expect(digest.daniel_decisions.map(({ id }) => id)).toEqual(['abc100', 'abc200']);
	expect(digest.counts).toMatchObject({ needs_daniel: 8, daniel_decisions: 2, pings: 6 });
	const text = fixture.repository.digestText(NOW);
	expect(text).toContain('CoS/WORKER PINGS (6)');
	expect(text).toContain('  ... and 1 more');
	expect(text).not.toMatch(/NEEDS DANIEL \(\d+\)\n/);
	expect(text.slice(text.indexOf('To unblock (Daniel)'))).not.toContain('pa000');
});
