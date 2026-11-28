// @harness-uid u_xba7ieg4je
import { trackerItemPriority } from '../../../utils/projects-sessions/trackerItemPriority';
import type {
	TrackerDigest,
	TrackerDigestGroups,
	TrackerDigestItem,
	TrackerItemRow,
	TrackerRecurringProblem
} from '../TrackerItemReadRepository.types';
import type { TrackerRunReadRepository } from '../TrackerRunReadRepository';
import { openLaunchHold, trackerChaseFields, trackerAskFields } from './serializeTrackerItem';
import { trackerPlanningStage } from '../../../utils/projects-sessions/trackerPlanning';
import { splitTrackerAsks, listTrackerUnblocks, isStaleDecision } from './splitTrackerAsks';
import { launchRequestedAt, stampTrackerTime } from './stampTrackerTime';
import type { StoredRecurringResult, TrackerDigestSources } from './buildTrackerDigest.types';

/** Group active items by the configured calendar day and current recurring outcome. */
export function buildTrackerDigest(
	rows: TrackerItemRow[],
	nowMs: number,
	timeZone: string,
	{ runs, projects }: TrackerDigestSources
): TrackerDigest {
	const localTime = stampTrackerTime(nowMs, timeZone);
	const [today] = localTime.split(' ');
	const groups: TrackerDigestGroups = {
		blocked: [],
		needs_daniel: [],
		daniel_decisions: [],
		pings: [],
		needs_options: [],
		overdue: [],
		due_today: [],
		recurring_missed: [],
		chased_7d: [],
		queued: [],
		launch_holds: []
	};
	for (const row of rows) {
		const item = summarize(row, nowMs);
		followThrough(groups, { row, item, nowMs, runs });
		if (digestActive(row, nowMs)) {
			groupActive(groups, row, item, { today, timeZone });
			const held = openLaunchHold(row, item, nowMs);
			if (held) groups.launch_holds.push(held);
		}
	}
	splitTrackerAsks(groups);
	groups.chased_7d.sort((a, b) => (b.chased_at ?? '').localeCompare(a.chased_at ?? ''));
	groups.queued.sort((a, b) => a.requested_at.localeCompare(b.requested_at));
	const toUnblock = listTrackerUnblocks(groups);
	return {
		generated_at: new Date(nowMs).toISOString(),
		local_time: `${localTime} ${timeZone}`,
		today,
		...groups,
		projects,
		to_unblock: toUnblock,
		counts: {
			...(Object.fromEntries(
				Object.entries(groups).map(([key, items]) => [key, items.length])
			) as Record<keyof TrackerDigestGroups, number>),
			stale_decisions: groups.daniel_decisions.filter(isStaleDecision).length,
			projects: projects.length,
			to_unblock: toUnblock.length
		}
	};
}

function followThrough(
	groups: TrackerDigestGroups,
	{
		row,
		item,
		nowMs,
		runs
	}: { row: TrackerItemRow; item: TrackerDigestItem; nowMs: number; runs: TrackerRunReadRepository }
) {
	const chasedAt = Date.parse(item.chased_at ?? '');
	if (chasedAt <= nowMs && chasedAt >= nowMs - 7 * 86_400_000) groups.chased_7d.push(item);
	if (item.needs_daniel) groups.needs_daniel.push(item);
	const queue = queuedLaunch(row, item, nowMs, runs);
	if (queue) groups.queued.push(queue);
}

function groupActive(
	groups: TrackerDigestGroups,
	row: TrackerItemRow,
	item: TrackerDigestItem,
	{ today, timeZone }: { today: string; timeZone: string }
) {
	if (row.status === 'blocked') groups.blocked.push(item);
	if (row.every) {
		const problem = recurringProblem(row, row.every, item, timeZone);
		if (problem) groups.recurring_missed.push(problem);
	} else if (row.due) {
		const day =
			row.due.length === 10
				? row.due
				: stampTrackerTime(Date.parse(row.due), timeZone).split(' ')[0];
		if (day < today) groups.overdue.push(item);
		if (day === today) groups.due_today.push(item);
	}
}

function digestActive(row: TrackerItemRow, now: number): boolean {
	return (
		row.status !== 'done' &&
		row.status !== 'ignored' &&
		!(Date.parse(row.remind_at ?? '') > now) &&
		!(Date.parse(row.parked_until ?? '') > now)
	);
}
function summarize(row: TrackerItemRow, now: number): TrackerDigestItem {
	const needsDaniel = row.status !== 'ignored' && Boolean(row.needs_daniel) && !row.resolved;
	return {
		id: row.id,
		kind: row.kind,
		priority: trackerItemPriority(row.priority, 'normal'),
		title: row.title,
		status: row.status,
		stage: trackerPlanningStage(row),
		blocked_reason: row.status === 'blocked' ? row.blocked_reason : null,
		needs_daniel: needsDaniel,
		...(row.next_step && {
			next_step: row.next_step,
			...(row.project && { project: row.project })
		}),
		...(row.parked_until &&
			Date.parse(row.parked_until) > now && { parked_until: row.parked_until }),
		...trackerChaseFields(row),
		due: row.due,
		...(row.remind_at && { remind_at: row.remind_at }),
		owner: row.owner,
		agent: row.agent,
		question: row.question,
		...trackerAskFields(row, needsDaniel, now),
		created_by: row.created_by,
		updated_at: row.updated_at
	};
}

function queuedLaunch(
	row: TrackerItemRow,
	item: TrackerDigestItem,
	now: number,
	runs: TrackerRunReadRepository
) {
	if (!row.auto || item.needs_daniel || !['open', 'in_progress'].includes(row.status ?? ''))
		return undefined;
	const attempts = runs.list({ itemId: row.id }).filter((run) => run.auto_token === row.auto);
	if (attempts.length && attempts.every((run) => run.state !== 'queued')) return undefined;
	const at = launchRequestedAt(row, now);
	return {
		...item,
		requested_at: new Date(at).toISOString(),
		waiting_minutes: Math.max(0, Math.floor((now - at) / 60_000)),
		computer: row.launch_target ?? row.computer
	};
}

function recurringProblem(
	row: TrackerItemRow,
	every: string,
	item: TrackerDigestItem,
	timeZone: string
): TrackerRecurringProblem | null {
	const result = recurringResult(row.last_result);
	const missed = unresolvedMiss(row.missed, result);
	const failed = currentFailure(row.occurrence, result);
	if (!missed && !failed) return null;
	const occurrenceZone = row.every_tz === '' ? null : row.every_tz;
	const displayZone = occurrenceZone ?? timeZone;
	return {
		...item,
		every,
		every_tz: occurrenceZone ?? 'Europe/Lisbon',
		missed,
		missed_local: missed ? stampTrackerTime(Date.parse(missed), displayZone) : null,
		failed,
		failed_local: failed ? stampTrackerTime(Date.parse(failed.occurrence), displayZone) : null
	};
}

function unresolvedMiss(
	missed: string | null,
	result: StoredRecurringResult | null
): string | null {
	if (!missed) return null;
	if (result?.status === 'done' && result.occurrence && result.occurrence > missed) return null;
	return missed;
}

function currentFailure(
	occurrence: string | null,
	result: StoredRecurringResult | null
): TrackerRecurringProblem['failed'] {
	if (result?.status !== 'failed' || result.occurrence !== occurrence) return null;
	const note = result.note === '' ? null : (result.note ?? null);
	return { occurrence: result.occurrence, note };
}

function recurringResult(raw: string | null): StoredRecurringResult | null {
	try {
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}
