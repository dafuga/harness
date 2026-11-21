import { expect, test } from 'vitest';
import { nextReminderAt } from '../../../src/helpers/attention-timing/nextReminderAt';

const LISBON = { tz: 'Europe/Lisbon', start: '22:00', end: '08:00' };
const HOUR = 60 * 60e3;
const at = (iso: string) => Date.parse(iso);

test('nextReminderAt is one interval after the last ping', () => {
	expect(nextReminderAt(at('2026-11-16T10:05:00Z'), HOUR, LISBON)).toBe(at('2026-11-16T11:05:00Z'));
});

test('nextReminderAt that lands in quiet hours is held to 08:00 (summer time too)', () => {
	// last ping 21:40 Lisbon (UTC+1); one hour later is 22:40, held to 08:00 the next day
	expect(nextReminderAt(at('2026-07-01T20:40:00Z'), HOUR, LISBON)).toBe(at('2026-07-02T07:00:00Z'));
});

test('nextReminderAt without quiet hours is just the interval', () => {
	expect(nextReminderAt(at('2026-11-16T23:30:00Z'), HOUR, undefined)).toBe(
		at('2026-11-17T00:30:00Z')
	);
});
