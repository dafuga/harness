// @harness-uid u_6d3toxchme
import type { OverviewCallout, OverviewItem, OverviewRun } from './projectOverview.types';
import type { IncludedTrackerItem } from './projectOverviewTracker.types';
import { sanitizeText } from './projectOverviewPrivacy';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;

/** @pure A tracker timestamp in the single ISO form the snapshot always uses. */
export function isoTime(value: string): string {
	return new Date(value).toISOString();
}

/** @pure True when the change time is within the window, inclusive of its last millisecond. */
export function isWithin(updatedAt: string, windowMs: number, now: number): boolean {
	return now - Date.parse(updatedAt) <= windowMs;
}

/** @pure An item as shown on a card. Stale means in progress, not live, and unchanged for over 24 hours. */
export function toOverviewItem(
	record: IncludedTrackerItem,
	runs: OverviewRun[],
	now: number
): OverviewItem {
	const updatedAt = isoTime(record.updated_at);
	return {
		id: record.id,
		title: sanitizeText(record.title),
		status: record.status,
		updatedAt,
		due: record.due ? isoTime(record.due) : null,
		live: runs.length > 0,
		...(runs.length ? { runs: [...runs].sort(compareRuns).slice(0, 10) } : {}),
		stale: record.status === 'in_progress' && runs.length === 0 && !isWithin(updatedAt, DAY_MS, now)
	};
}

function compareRuns(a: OverviewRun, b: OverviewRun): number {
	return b.id - a.id || compareText(a.computer ?? '', b.computer ?? '');
}

/** @pure A callout pairs an item with its sanitized question or reason. */
export function toCallout(
	record: IncludedTrackerItem,
	text: string | null | undefined,
	runs: OverviewRun[],
	now: number
): OverviewCallout {
	return {
		item: toOverviewItem(record, runs, now),
		text: sanitizeText(text || record.title)
	};
}

/** @pure Live items first, then the earliest due date with no due date last, then id. */
export function compareItems(a: OverviewItem, b: OverviewItem): number {
	if (a.live !== b.live) return a.live ? -1 : 1;
	if (a.due !== b.due) {
		if (a.due === null) return 1;
		if (b.due === null) return -1;
		return a.due < b.due ? -1 : 1;
	}
	return compareText(a.id, b.id);
}

/** @pure Ordered comparison of two strings: negative, zero or positive. */
export function compareText(a: string, b: string): number {
	if (a === b) return 0;
	return a < b ? -1 : 1;
}
