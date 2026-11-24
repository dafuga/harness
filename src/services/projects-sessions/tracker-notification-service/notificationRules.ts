// @harness-uid u_vqnqshfas2
import { createHash } from 'node:crypto';
import { nextReminderSlotAt } from '../../../helpers/attention-timing/nextReminderSlotAt';
import { quietHourBoundary } from '../../../helpers/attention-timing/quietHourBoundary';
import { wallClockToEpochMs } from '../../../helpers/attention-timing/wallClockToEpochMs';
import { zonedWallClock } from '../../../helpers/attention-timing/zonedWallClock';
import type {
	TrackerNotificationItem,
	TrackerNotificationOptions
} from '../TrackerNotificationService.types';

export const minute = 60_000;
const lisbon = 'Europe/Lisbon';
export const askQuietHours = { start: '22:00', end: '08:00', tz: lisbon };

export function nextAskAt(numberSent: number, first: number, now: number): number {
	const delay = [120, 360][numberSent - 1];
	if (delay !== undefined && first + delay * minute > now)
		return quietHourBoundary(first + delay * minute, askQuietHours);
	return nextReminderSlotAt(now, ['08:00'], lisbon);
}

export function intervalMs(minutes: number | undefined, fallback: number): number {
	if (!minutes) return fallback * minute;
	return minutes * minute;
}

export function isoTime(time: number): string {
	return new Date(time).toISOString();
}

export function clockTime(clock: string | undefined): number {
	return Number(/^(\d{15})-\d{6}-.+$/.exec(clock ?? '')?.[1] ?? 0);
}

export function eventId(keys: readonly string[]): string {
	return createHash('sha256')
		.update([...keys].sort().join('\n'))
		.digest('hex')
		.slice(0, 32);
}

export function activeItem(
	item: TrackerNotificationItem | undefined
): item is TrackerNotificationItem {
	return (
		!!item &&
		item.title !== null &&
		item.status !== null &&
		!item.deleted &&
		item.status !== 'done' &&
		item.status !== 'ignored'
	);
}

export function flagged(
	item: TrackerNotificationItem | undefined
): item is TrackerNotificationItem {
	return (
		!!item?.title &&
		!!item.status &&
		!item.deleted &&
		item.status !== 'ignored' &&
		!!item.needs_daniel &&
		!item.resolved
	);
}

export function dueTime(value: string | null, tz: string): number | null {
	if (!value) return null;
	const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (date) {
		const [, year, month, day] = date.map(Number);
		return wallClockToEpochMs({ year, month, day, hour: 0, minute: 0 }, tz);
	}
	const at = Date.parse(value);
	return Number.isNaN(at) ? null : at;
}

export function localDay(at: number, tz: string): number {
	const { year, month, day } = zonedWallClock(at, tz);
	return year * 10_000 + month * 100 + day;
}

export function parkedUntil(item: TrackerNotificationItem | undefined): number {
	return Date.parse(item?.parked_until ?? '') || 0;
}

export function holdRegularReminder(
	item: TrackerNotificationItem,
	now: number,
	interval: number | undefined
): boolean {
	return (
		parkedUntil(item) > now || Date.parse(item.remind_at ?? '') + intervalMs(interval, 60) > now
	);
}

export function readyRows<T extends { createdAt: number; nextAt: number }>(
	rows: Iterable<T>,
	now: number,
	pending: (row: T) => boolean
): T[] {
	return [...rows]
		.filter((row) => pending(row) && row.nextAt <= now)
		.sort((a, b) => a.createdAt - b.createdAt);
}

export function dueForDirectReminder(
	item: TrackerNotificationItem,
	options: TrackerNotificationOptions,
	today: number
) {
	if (!options.chiefOfStaff || options.scheduledOnly || !activeItem(item) || item.every)
		return false;
	const due = dueTime(item.due, options.source.tz);
	return due !== null && localDay(due, options.source.tz) <= today;
}
