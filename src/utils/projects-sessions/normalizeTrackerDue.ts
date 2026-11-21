import type { TrackerItemClock } from './normalizeTrackerItemFields.types';
import { trackerItemError } from './trackerItemError';
import { trackerItemValueOr } from './trackerItemValueOr';

export const trackerTimeZone = 'Europe/Lisbon';

export function trackerDateFormatter(timeZone: string): Intl.DateTimeFormat {
	return new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
}

export function trackerDateParts(time: number, formatter: Intl.DateTimeFormat) {
	const parts = Object.fromEntries(
		formatter.formatToParts(time).map(({ type, value }) => [type, value])
	);
	return {
		year: Number(parts.year),
		month: Number(parts.month),
		day: Number(parts.day),
		hour: Number(parts.hour) % 24,
		minute: Number(parts.minute),
		second: Number(parts.second)
	};
}

const pad = (value: number) => String(value).padStart(2, '0');

function calendarDate(year: number, month: number, day: number): string {
	return `${year}-${pad(month)}-${pad(day)}`;
}

export function trackerLocalStamp(time: number, timeZone: string): string {
	const date = trackerDateParts(time, trackerDateFormatter(timeZone));
	return `${calendarDate(date.year, date.month, date.day)} ${pad(date.hour)}:${pad(date.minute)}`;
}

export function normalizeTrackerDue(value: unknown, clock: TrackerItemClock): string | null {
	if (value === null || value === undefined || value === '' || value === 'none') return null;
	const text = String(value).trim();
	const relative = /^\+(\d+)d$/.exec(text);
	if (text === 'today') return trackerDueDay(clock, 0);
	if (text === 'tomorrow') return trackerDueDay(clock, 1);
	if (relative) return trackerDueDay(clock, Number(relative[1]));
	if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

	const date = Date.parse(text);
	if (Number.isNaN(date)) {
		throw trackerItemError(
			`bad due date "${text}" (use YYYY-MM-DD, ISO time, today, tomorrow or +Nd)`
		);
	}
	return new Date(date).toISOString();
}

function trackerDueDay(clock: TrackerItemClock, offset: number): string {
	const date = trackerDateParts(
		clock.now,
		trackerDateFormatter(trackerItemValueOr(clock.timeZone, trackerTimeZone))
	);
	const day = new Date(Date.UTC(date.year, date.month - 1, date.day + offset));
	return calendarDate(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate());
}

export function trackerIsoTime(epoch: number): string {
	return new Date(epoch).toISOString();
}

export function validateTrackerTimeZone(timeZone: string): void {
	try {
		trackerDateFormatter(timeZone);
	} catch {
		throw trackerItemError(`unknown time zone "${timeZone}"`);
	}
}
