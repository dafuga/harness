// @harness-uid u_q7tlm7xp4x
import {
	trackerNonWorkAgent,
	trackerUnattendedHold
} from '../../../../../../src/utils/projects-sessions/trackerUnattendedHold';
import type {
	TrackerItemRecord,
	TrackerRunRecord
} from '../project-overview/projectOverviewTracker.types';
import type { HomePastDue, HomeRun, HomeWhenDue, OwnerHomeSnapshot } from './hubHome.types';
import { homeText } from './homeTrackerText';

const upcomingLimit = 120;
const pastDueLimit = 200;
const stateOrder: Record<HomeWhenDue['state'], number> = {
	running: 0,
	queued: 1,
	due: 2,
	blocked: 3
};
const unreported = 'This computer has not reported why it has not started';

const holdText: Record<string, string> = {
	'production deploy requires an explicit launch': 'A production deploy; start it by hand',
	'decision or reminder for Daniel': 'A decision or reminder for you'
};

/** Why an item that is not running would not be started by the launcher, or null when it would. */
function blocker(item: TrackerItemRecord): string | null {
	if (item.needs_daniel && !item.resolved) return 'Waiting on your answer';
	if (item.status === 'blocked')
		return homeText(item.blocked_reason, 200) ?? 'Blocked; no reason recorded';
	if (item.launchRequested) return null;
	if (item.status === 'in_progress') return null;
	return neverLaunches(item);
}

function neverLaunches(item: TrackerItemRecord): string | null {
	if (item.kind === 'reminder') return 'A reminder; it does not launch';
	if (item.kind && item.kind !== 'task') return 'A plan; only tasks launch';
	if (item.scheduleOff) return 'Automatic launch is off';
	if (item.recurring) return 'A repeating item that missed this run';
	const hold = trackerUnattendedHold(item);
	return hold && (holdText[hold] ?? hold);
}

/** Urgent runs sort first and low ones last; every other priority sits between them. */
const urgencies: Record<string, number | undefined> = { urgent: 0, low: 2 };

function whenDue(item: TrackerItemRecord, live: boolean, queued: boolean): HomeWhenDue {
	const urgency = urgencies[item.priority ?? ''] ?? 1;
	if (live) return { state: 'running', reason: null, urgency };
	const reason = blocker(item);
	if (reason) return { state: 'blocked', reason, urgency };
	return { state: queued || item.launchRequested ? 'queued' : 'due', reason: null, urgency };
}

function itemRun(item: TrackerItemRecord, live: boolean, queued: boolean): HomeRun[] {
	const at = item.recurring ? (item.occurrence ?? item.due) : item.due;
	if (!at || item.status === 'done') return [];
	return [
		{
			id: item.id,
			title: homeText(item.title, 500) ?? 'Untitled task',
			at: new Date(at).toISOString(),
			agent: homeText(item.agent, 200),
			machine: homeText(item.computer, 200),
			source: 'tracker',
			recurring: Boolean(item.recurring),
			paused: Boolean(item.scheduleOff),
			whenDue: whenDue(item, live, queued)
		}
	];
}

const byTime = (left: HomeRun, right: HomeRun) => left.at.localeCompare(right.at);
const isUpcoming = (run: HomeRun, now: number) => Date.parse(run.at) > now;

/** Future runs and past-due work are listed and bounded apart, so neither hides the other. */
export function listHomeSchedule(
	{ items, runs }: { items: TrackerItemRecord[]; runs: TrackerRunRecord[] },
	routines: HomeRun[],
	now: number
) {
	const live = new Set(
		runs.filter((run) => run.state === 'running' && run.ended_at === null).map((run) => run.item_id)
	);
	const queued = new Set(
		runs.filter((run) => run.state === 'queued' && run.ended_at === null).map((run) => run.item_id)
	);
	// Personal and family work never appears on the Hub.
	const shown = items.filter((item) => !trackerNonWorkAgent(item.agent));
	// Only work that has not started yet is still scheduled; the rest is already Work in progress.
	const upcoming = shown.flatMap((item) =>
		item.status === 'open'
			? itemRun(item, false, queued.has(item.id)).filter((run) => isUpcoming(run, now))
			: []
	);
	const passed = shown
		.flatMap((item) => itemRun(item, live.has(item.id), queued.has(item.id)))
		.filter((run) => !isUpcoming(run, now));
	return {
		scheduled: [...upcoming, ...routines.filter((run) => isUpcoming(run, now))]
			.sort(byTime)
			.slice(0, upcomingLimit),
		overdue: passed
			.sort(
				(left, right) =>
					stateOrder[left.whenDue!.state] - stateOrder[right.whenDue!.state] || byTime(left, right)
			)
			.slice(0, pastDueLimit)
	};
}

function toPastDue(run: HomeRun): HomePastDue {
	const due = run.whenDue ?? { state: 'blocked' as const, reason: unreported, urgency: 1 };
	return { ...run, state: due.state, reason: due.reason };
}

function launchOrder(left: HomePastDue, right: HomePastDue) {
	return (left.whenDue?.urgency ?? 1) - (right.whenDue?.urgency ?? 1) || byTime(left, right);
}

/**
 * @pure The schedule as of now. A published run whose time has since passed, or one sent by an
 * older computer, is never listed as scheduled.
 */
export function splitHomeSchedule(
	snapshot: Pick<OwnerHomeSnapshot, 'scheduled' | 'overdue'>,
	now: number
) {
	const upcoming = snapshot.scheduled.filter((run) => isUpcoming(run, now));
	const passed = snapshot.scheduled.filter(
		(run) => run.source === 'tracker' && !isUpcoming(run, now)
	);
	const all = [...(snapshot.overdue ?? []), ...passed].map(toPastDue);
	const inState = (state: HomePastDue['state']) => all.filter((run) => run.state === state);
	const pastDue: HomePastDue[] = [
		...inState('running').sort(byTime),
		...inState('queued')
			.sort(launchOrder)
			.map((run, index) => ({ ...run, position: index + 1 })),
		...inState('due').sort(byTime),
		...inState('blocked').sort(byTime)
	];
	return { upcoming, pastDue };
}
