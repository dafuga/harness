import { expect, test } from 'vitest';
import { isQuietHour } from '../../../src/helpers/attention-timing/isQuietHour';

const LISBON = { tz: 'Europe/Lisbon', start: '22:00', end: '08:00' };
const at = (iso: string) => Date.parse(iso);

test('isQuietHour: 22:00 up to 08:00 Lisbon, end exclusive, across midnight', () => {
	expect(isQuietHour(at('2026-11-16T21:59:00Z'), LISBON)).toBe(false);
	expect(isQuietHour(at('2026-11-16T22:00:00Z'), LISBON)).toBe(true);
	expect(isQuietHour(at('2026-11-17T07:59:00Z'), LISBON)).toBe(true);
	expect(isQuietHour(at('2026-11-17T08:00:00Z'), LISBON)).toBe(false);
});

test('isQuietHour follows the zone offset in summer time', () => {
	expect(isQuietHour(at('2026-07-01T20:40:00Z'), LISBON)).toBe(false); // 21:40 Lisbon
	expect(isQuietHour(at('2026-07-01T21:30:00Z'), LISBON)).toBe(true); // 22:30 Lisbon
});

test('isQuietHour is false without quiet hours, and when start equals end', () => {
	expect(isQuietHour(at('2026-11-16T23:30:00Z'), null)).toBe(false);
	expect(
		isQuietHour(at('2026-11-16T23:30:00Z'), { tz: 'Europe/Lisbon', start: '00:00', end: '00:00' })
	).toBe(false);
});
