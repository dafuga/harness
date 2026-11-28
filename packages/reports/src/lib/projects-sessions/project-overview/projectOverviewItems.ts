// @harness-uid u_6d3toxchme
import { trackerMachineRole } from '../../../../../../src/utils/projects-sessions/trackerMachineStatus';
import type { OverviewCallout, OverviewItem, OverviewMachine } from './projectOverview.types';
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
	live: boolean,
	now: number
): OverviewItem {
	const updatedAt = isoTime(record.updated_at);
	return {
		id: record.id,
		title: sanitizeText(record.title),
		status: record.status,
		updatedAt,
		due: record.due ? isoTime(record.due) : null,
		live,
		stale: record.status === 'in_progress' && !live && !isWithin(updatedAt, DAY_MS, now)
	};
}

/** @pure A callout pairs an item with its sanitized question or reason. */
export function toCallout(
	record: IncludedTrackerItem,
	text: string | null | undefined,
	live: boolean,
	now: number
): OverviewCallout {
	return {
		item: toOverviewItem(record, live, now),
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

/** @pure Online primary first, then other online computers, then offline computers by name. */
export function compareOverviewMachines(a: OverviewMachine, b: OverviewMachine): number {
	return computerRank(a) - computerRank(b) || compareText(a.name, b.name);
}

function computerRank({ name, status }: OverviewMachine): number {
	if (status === 'offline') return 2;
	return trackerMachineRole(name) === 'primary' ? 0 : 1;
}
