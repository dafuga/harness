// @harness-uid u_she4zhubqu
import type {
	OverviewCallout,
	OverviewCard,
	OverviewItem,
	OverviewSnapshot,
	ProjectState
} from './projectOverview.types';
import type {
	IncludedTrackerItem,
	TrackerRunRecord,
	TrackerSources
} from './projectOverviewTracker.types';
import {
	compareItems,
	compareOverviewMachines,
	DAY_MS,
	isWithin,
	isoTime,
	toCallout,
	compareText,
	toOverviewItem,
	WEEK_MS
} from './projectOverviewItems';
import { isIncludedItem, sanitizeText } from './projectOverviewPrivacy';
import { trackerStructuredAsk } from '../../../../../../src/utils/projects-sessions/trackerStructuredAsk';

const STATE_RANK: Record<ProjectState, number> = {
	'needs-you': 0,
	blocked: 1,
	active: 2,
	quiet: 3,
	done: 4
};

/** Project validated tracker records into the overview. Pure: the same records and time give the same snapshot. */
export function projectOverviewSnapshot(sources: TrackerSources, now: number): OverviewSnapshot {
	// Labels are sanitized for display only; the offline set and run joins keep the raw node names.
	const offline = new Set(
		sources.machines
			.filter((machine) => machine.status === 'offline')
			.map((machine) => machine.node)
	);
	const machines = sources.machines
		.map(({ node, status, remoteRuns, utilization }) => ({
			name: sanitizeText(node),
			status,
			...(remoteRuns !== undefined && { remoteRuns }),
			...(utilization && { utilization })
		}))
		.sort(compareOverviewMachines);
	const items = sources.items.filter(isIncludedItem);
	const liveByItem = countLiveRuns(sources.runs, new Set(items.map((item) => item.id)), offline);
	const cards = [...groupByAgent(items).entries()]
		.map(([agent, rows]) => buildCard(agent, rows, liveByItem, now))
		.filter((card): card is OverviewCard => card !== null)
		.sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || compareText(a.agent, b.agent));
	return {
		status: 'ready',
		projects: cards,
		machines,
		liveSessions: cards.reduce((sum, card) => sum + card.liveSessions, 0)
	};
}

/**
 * @pure Count each live run once per item. Runs on offline computers and runs of items
 * that are not on a card are ignored; the run's own project field is never read.
 */
function countLiveRuns(
	runs: TrackerRunRecord[],
	itemIds: ReadonlySet<string>,
	offline: ReadonlySet<string>
): Map<string, number> {
	const seen = new Set<string>();
	const counts = new Map<string, number>();
	for (const run of runs) {
		if (run.state !== 'running' || run.ended_at !== null || !itemIds.has(run.item_id)) continue;
		if (run.node && offline.has(run.node)) continue;
		const key = `${run.node ?? ''}:${run.id}`;
		if (seen.has(key)) continue;
		seen.add(key);
		counts.set(run.item_id, (counts.get(run.item_id) ?? 0) + 1);
	}
	return counts;
}

function groupByAgent(items: IncludedTrackerItem[]): Map<string, IncludedTrackerItem[]> {
	const groups = new Map<string, IncludedTrackerItem[]>();
	for (const item of items) {
		const rows = groups.get(item.agent) ?? [];
		rows.push(item);
		groups.set(item.agent, rows);
	}
	return groups;
}

/** Build one card, or null when the project has finished and its last completion is older than seven days. */
function buildCard(
	agent: string,
	rows: IncludedTrackerItem[],
	liveByItem: ReadonlyMap<string, number>,
	now: number
): OverviewCard | null {
	const liveOf = (id: string) => (liveByItem.get(id) ?? 0) > 0;
	const liveSessions = rows.reduce((sum, row) => sum + (liveByItem.get(row.id) ?? 0), 0);
	const updatedAt = newest(rows.map((row) => row.updated_at));
	const state = pickState(rows, liveSessions, updatedAt, now);
	if (state === null) return null;
	return {
		agent: sanitizeText(agent),
		state,
		liveSessions,
		counts: countStatuses(rows),
		items: rows
			.filter((row) => row.status === 'in_progress')
			.map((row) => toOverviewItem(row, liveOf(row.id), now))
			.sort(compareItems),
		attention: attentionCallout(rows, liveOf, now),
		blocked: blockedCallout(rows, liveOf, now),
		milestone: latestMilestone(rows),
		updatedAt: isoTime(updatedAt)
	};
}

/** The first matching state in order: needs you, blocked, active, quiet, done. */
function pickState(
	rows: IncludedTrackerItem[],
	liveSessions: number,
	updatedAt: string,
	now: number
): ProjectState | null {
	if (rows.some(needsAnswer)) return 'needs-you';
	if (liveSessions === 0 && rows.some((row) => row.status === 'blocked')) return 'blocked';
	const changedToday = rows.some(
		(row) => row.status === 'in_progress' && isWithin(row.updated_at, DAY_MS, now)
	);
	if (liveSessions > 0 || changedToday) return 'active';
	if (rows.every((row) => row.status === 'done')) {
		return isWithin(updatedAt, WEEK_MS, now) ? 'done' : null;
	}
	return 'quiet';
}

/** @pure An open structured ask. A flag without choices, such as a dependency block, is not Daniel's. */
function needsAnswer(row: IncludedTrackerItem): boolean {
	return trackerStructuredAsk(row);
}

function attentionCallout(
	rows: IncludedTrackerItem[],
	liveOf: (id: string) => boolean,
	now: number
): OverviewCallout | null {
	const row = newestRow(rows.filter(needsAnswer));
	return row ? toCallout(row, row.question || row.blocked_reason, liveOf(row.id), now) : null;
}

function blockedCallout(
	rows: IncludedTrackerItem[],
	liveOf: (id: string) => boolean,
	now: number
): OverviewCallout | null {
	const row = newestRow(rows.filter((candidate) => candidate.status === 'blocked'));
	return row ? toCallout(row, row.blocked_reason, liveOf(row.id), now) : null;
}

/** @pure The newest note across the project's items, with its time in the snapshot form. */
function latestMilestone(rows: IncludedTrackerItem[]): { text: string; at: string } | null {
	let best: { text: string; at: string; time: number } | null = null;
	for (const row of rows) {
		for (const note of row.notes_log ?? []) {
			const time = Date.parse(note.at);
			if (best === null || time > best.time)
				best = { text: sanitizeText(note.text), at: isoTime(note.at), time };
		}
	}
	return best === null ? null : { text: best.text, at: best.at };
}

function countStatuses(rows: IncludedTrackerItem[]): Record<OverviewItem['status'], number> {
	const counts = { open: 0, in_progress: 0, blocked: 0, done: 0 };
	for (const row of rows) counts[row.status] += 1;
	return counts;
}

function newestRow(rows: IncludedTrackerItem[]): IncludedTrackerItem | null {
	let best: IncludedTrackerItem | null = null;
	for (const row of rows) {
		if (best === null || Date.parse(row.updated_at) > Date.parse(best.updated_at)) best = row;
	}
	return best;
}

function newest(times: string[]): string {
	return times.reduce((best, time) => (Date.parse(time) > Date.parse(best) ? time : best));
}
