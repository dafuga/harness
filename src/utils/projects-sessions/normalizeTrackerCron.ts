// @harness-uid u_dv4lnm54rz
import {
	trackerDateFormatter,
	trackerDateParts,
	validateTrackerTimeZone
} from './normalizeTrackerDue';
import type { TrackerItemValue } from './normalizeTrackerItemFields.types';
import { trackerItemError } from './trackerItemError';
import { trackerItemValueOr } from './trackerItemValueOr';
import type { CronField, CronSchedule, CronTimeCache } from './normalizeTrackerCron.types';

const macros: Readonly<Record<string, string>> = {
	'@hourly': '0 * * * *',
	'@daily': '0 0 * * *',
	'@midnight': '0 0 * * *',
	'@weekly': '0 0 * * 0',
	'@monthly': '0 0 1 * *',
	'@yearly': '0 0 1 1 *',
	'@annually': '0 0 1 1 *'
};

const fields: readonly CronField[] = [
	{ name: 'minute', min: 0, max: 59 },
	{ name: 'hour', min: 0, max: 23 },
	{ name: 'day-of-month', min: 1, max: 31 },
	{
		name: 'month',
		min: 1,
		max: 12,
		names: 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ')
	},
	{ name: 'day-of-week', min: 0, max: 7, names: 'sun mon tue wed thu fri sat'.split(' ') }
];
const dayMs = 86_400_000;

/** Validate against the same five-year horizon as Tracker 122e190, at the supplied time. */
export function normalizeTrackerCron(
	value: TrackerItemValue,
	timeZone: string,
	now: number
): string {
	validateTrackerTimeZone(timeZone);
	const raw = String(trackerItemValueOr(value, '')).trim();
	trackerCronOccurrences(raw, timeZone)(now);
	return raw.replace(/\s+/g, ' ');
}

/** Find each next occurrence in legacy wall-clock order, reusing offsets during catch-up. */
export function trackerCronOccurrences(raw: string, timeZone: string): (after: number) => number {
	const schedule = parseSchedule(raw);
	const formatter = trackerDateFormatter(timeZone);
	const times = [...schedule.hours]
		.flatMap((hour) => [...schedule.minutes].map((minute) => (hour * 60 + minute) * 60_000))
		.sort((left, right) => left - right);
	const cache = new Map<number, Map<number, number>>();
	return (after) => {
		const date = trackerDateParts(after, formatter);
		const start = Date.UTC(date.year, date.month - 1, date.day) - dayMs;
		for (let index = 0; index < 366 * 5 + 2; index++) {
			const day = start + index * dayMs;
			if (!matchesDay(schedule, new Date(day))) continue;
			const next = nextWallTime(day, after, { times, formatter, cache });
			if (next !== undefined) return next;
		}
		throw trackerItemError('cron "?" never fires');
	};
}

function parseSchedule(raw: string): CronSchedule {
	const macro = raw.toLowerCase();
	const parts = (Object.hasOwn(macros, macro) ? macros[macro] : raw).split(/\s+/);
	if (parts.length !== 5) {
		throw trackerItemError(
			`cron needs 5 fields (minute hour day-of-month month day-of-week), got "${raw}"`
		);
	}
	const [minutes, hours, daysOfMonth, months, daysOfWeek] = parts.map((part, index) =>
		parseField(part, fields[index])
	);
	if (daysOfWeek.delete(7)) daysOfWeek.add(0);
	return {
		minutes,
		hours,
		daysOfMonth,
		months,
		daysOfWeek,
		anyDayOfMonth: parts[2] === '*',
		anyDayOfWeek: parts[4] === '*'
	};
}

function parseField(text: string, field: CronField): Set<number> {
	const values = new Set<number>();
	for (const part of text.split(',')) {
		const [range, stepText] = part.split('/');
		const step = stepText === undefined ? 1 : Number(stepText);
		if (!Number.isInteger(step) || step < 1) {
			throw trackerItemError(`bad step in ${field.name} "${part}"`);
		}
		const [lo, hi] = cronRange(range, stepText !== undefined, field);
		for (let value = lo; value <= hi; value += step) values.add(value);
	}
	return values;
}

function cronRange(range: string, stepped: boolean, field: CronField): [number, number] {
	if (range === '*') return [field.min, field.max];
	if (range.includes('-')) {
		const [left, right] = range.split('-');
		const lo = cronValue(left, field);
		const hi = cronValue(right, field);
		if (lo > hi) throw trackerItemError(`bad range in ${field.name} "${range}"`);
		return [lo, hi];
	}
	const lo = cronValue(range, field);
	return [lo, stepped ? field.max : lo];
}

function cronValue(text: string, field: CronField): number {
	const index = field.names?.indexOf(text.toLowerCase()) ?? -1;
	if (index >= 0) return index + field.min;
	if (!/^\d+$/.test(text)) {
		throw trackerItemError(`bad ${field.name} value "${text}"`);
	}
	const value = Number(text);
	if (value < field.min || value > field.max) {
		throw trackerItemError(`${field.name} ${value} out of range ${field.min}-${field.max}`);
	}
	return value;
}

function matchesDay(schedule: CronSchedule, date: Date): boolean {
	if (!schedule.months.has(date.getUTCMonth() + 1)) return false;
	const dayOfMonth = schedule.daysOfMonth.has(date.getUTCDate());
	const dayOfWeek = schedule.daysOfWeek.has(date.getUTCDay());
	if (schedule.anyDayOfMonth) return schedule.anyDayOfWeek || dayOfWeek;
	if (schedule.anyDayOfWeek) return dayOfMonth;
	return dayOfMonth || dayOfWeek;
}

function nextWallTime(day: number, after: number, options: CronTimeCache): number | undefined {
	const { times, formatter, cache } = options;
	const resolved = cache.get(day) ?? new Map<number, number>();
	cache.set(day, resolved);
	if (cache.size > 3) cache.delete(cache.keys().next().value!);
	for (const time of times) {
		const epoch = resolved.get(time) ?? wallTime(day + time, formatter);
		resolved.set(time, epoch);
		if (epoch > after) return epoch;
	}
	return undefined;
}

function wallTime(guess: number, formatter: Intl.DateTimeFormat): number {
	const initial = guess - offsetAt(guess, formatter);
	return guess - offsetAt(initial, formatter);
}

function offsetAt(epoch: number, formatter: Intl.DateTimeFormat): number {
	const { year, month, day, hour, minute, second } = trackerDateParts(epoch, formatter);
	return Date.UTC(year, month - 1, day, hour, minute, second) - epoch;
}
