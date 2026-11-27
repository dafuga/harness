import { expect, test } from 'vitest';
import {
	buildHomeSnapshot,
	noProviders
} from '../../../reports/src/lib/projects-sessions/hub-home/homeTrackerProjection';
import { splitHomeSchedule } from '../../../reports/src/lib/projects-sessions/hub-home/homeSchedule';
import type { TrackerItemRecord } from '../../../reports/src/lib/projects-sessions/project-overview/projectOverviewTracker.types';
import { parseHomePayload } from '../../src/routes/api/hub-home/homePayload';

const now = Date.parse('2026-11-25T23:00:00Z');
const past = '2026-11-18T14:00:00.000Z';
const soon = '2026-11-26T09:00:00.000Z';

function item(id: string, patch: Partial<TrackerItemRecord> = {}): TrackerItemRecord {
	return {
		id,
		title: `Synthetic ${id}`,
		status: 'open',
		kind: 'task',
		agent: 'harness',
		updated_at: new Date(now).toISOString(),
		due: past,
		...patch
	};
}

function snapshot(items: TrackerItemRecord[], liveItem?: string) {
	const runs = liveItem
		? [{ id: 1, item_id: liveItem, state: 'running', ended_at: null, node: null }]
		: [];
	return buildHomeSnapshot({ items, runs, machines: [] }, noProviders, now);
}

const board = (items: TrackerItemRecord[], liveItem?: string, at = now) =>
	splitHomeSchedule(snapshot(items, liveItem), at);

test('nothing past due is listed as scheduled', () => {
	const view = board([
		item('queued'),
		item('future', { due: soon }),
		item('eta', { status: 'in_progress', due: soon }),
		item('stuck', { status: 'blocked', due: soon })
	]);
	expect(view.upcoming.map((run) => run.id)).toEqual(['future']);
	expect(view.pastDue.map((run) => run.id)).toEqual(['queued']);
});

test('each past-due item says whether it is running, queued or blocked', () => {
	const view = board(
		[
			item('live', { status: 'in_progress' }),
			item('stale', { status: 'in_progress' }),
			item('requested', { status: 'in_progress', launchRequested: true }),
			item('waiting', { status: 'blocked', blocked_reason: 'Waiting on the box' }),
			item('asks', { needs_daniel: true }),
			item('paused', { scheduleOff: true }),
			item('reminder', { kind: 'reminder' }),
			item('plan', { kind: 'plan' })
		],
		'live'
	);
	expect(Object.fromEntries(view.pastDue.map((run) => [run.id, [run.state, run.reason]]))).toEqual({
		live: ['running', null],
		requested: ['queued', null],
		stale: ['due', null],
		waiting: ['blocked', 'Waiting on the box'],
		asks: ['blocked', 'Waiting on your answer'],
		paused: ['blocked', 'Automatic launch is off'],
		reminder: ['blocked', 'A reminder; it does not launch'],
		plan: ['blocked', 'A plan; only tasks launch']
	});
});

test('personal and family work never appears, past due or upcoming', () => {
	const agents = ['cos', 'personal', 'boating', 'claire', 'doc', 'dad', 'life-coach', 'coach'];
	const view = board(
		[...agents, 'recruiting'].flatMap((agent) => [
			item(`${agent}-past`, { agent, status: 'blocked' }),
			item(`${agent}-next`, { agent, due: soon })
		])
	);
	expect([view.upcoming, view.pastDue]).toEqual([[], []]);
});

test('queued work is numbered in launch order: urgent first, then oldest due', () => {
	const view = board([
		item('newer', { launchRequested: true, due: '2026-11-20T09:00:00.000Z' }),
		item('older', { launchRequested: true }),
		item('low', { launchRequested: true, priority: 'low', due: '2026-11-10T09:00:00.000Z' }),
		item('urgent', { launchRequested: true, priority: 'urgent', due: '2026-11-24T09:00:00.000Z' })
	]);
	expect(view.pastDue.map((run) => [run.id, run.position])).toEqual([
		['urgent', 1],
		['older', 2],
		['newer', 3],
		['low', 4]
	]);
});

test('past-due items never crowd future runs out of the schedule', () => {
	const items = Array.from({ length: 150 }, (_, index) =>
		item(`old-${index}`, { status: 'blocked' })
	);
	const view = board([...items, item('future', { due: soon })]);
	expect(view.upcoming.map((run) => run.id)).toEqual(['future']);
	expect(view.pastDue).toHaveLength(150);
});

test('a run whose time passes after it was published leaves the schedule', () => {
	const items = [item('future', { due: soon })];
	const later = board(items, undefined, Date.parse(soon) + 1000);
	expect(later.upcoming).toEqual([]);
	expect(later.pastDue).toMatchObject([{ id: 'future', state: 'due' }]);
});

test('a Mac that reports past runs without a state still cannot show them as scheduled', () => {
	const old = snapshot([item('future', { due: soon })]);
	const legacy = { scheduled: [{ ...old.scheduled[0], at: past, whenDue: undefined }] };
	const view = splitHomeSchedule(legacy, now);
	expect(view.upcoming).toEqual([]);
	expect(view.pastDue).toMatchObject([
		{ state: 'blocked', reason: 'This computer has not reported why it has not started' }
	]);
});

test('the Hub keeps the past-due states a Mac publishes', () => {
	const parsed = parseHomePayload(
		JSON.parse(
			JSON.stringify(
				snapshot([item('queued', { launchRequested: true }), item('future', { due: soon })])
			)
		)
	);
	expect(parsed.overdue).toMatchObject([{ id: 'queued', whenDue: { state: 'queued' } }]);
	expect(parsed.scheduled).toMatchObject([{ id: 'future', whenDue: { state: 'due' } }]);
});
