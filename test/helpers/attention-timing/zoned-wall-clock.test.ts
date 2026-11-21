import { expect, test } from 'vitest';
import { zonedWallClock } from '../../../src/helpers/attention-timing/zonedWallClock';

test('zonedWallClock reads the wall clock of an instant in a zone, with DST', () => {
	expect(zonedWallClock(Date.parse('2026-11-16T23:30:00Z'), 'Europe/Lisbon')).toEqual({
		year: 2026,
		month: 11,
		day: 16,
		hour: 23,
		minute: 30,
		second: 0
	});
	expect(zonedWallClock(Date.parse('2026-07-01T19:40:00Z'), 'Europe/Lisbon')).toEqual({
		year: 2026,
		month: 7,
		day: 1,
		hour: 20,
		minute: 40,
		second: 0
	});
});

test('zonedWallClock reads midnight as hour 0, never 24', () => {
	expect(zonedWallClock(Date.parse('2026-11-17T00:00:00Z'), 'Europe/Lisbon').hour).toBe(0);
});
