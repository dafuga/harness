import { expect, test } from 'vitest';
import { wallClockToEpochMs } from '../../../src/helpers/attention-timing/wallClockToEpochMs';

test('wallClockToEpochMs converts a zone wall clock to UTC, across the DST change', () => {
	expect(
		wallClockToEpochMs({ year: 2026, month: 11, day: 17, hour: 8, minute: 0 }, 'Europe/Lisbon')
	).toBe(Date.parse('2026-11-17T08:00:00Z'));
	expect(
		wallClockToEpochMs({ year: 2026, month: 7, day: 2, hour: 8, minute: 0 }, 'Europe/Lisbon')
	).toBe(Date.parse('2026-07-02T07:00:00Z'));
});

test('wallClockToEpochMs accepts day overflow into the next month', () => {
	expect(
		wallClockToEpochMs({ year: 2026, month: 11, day: 31, hour: 8, minute: 0 }, 'Europe/Lisbon')
	).toBe(Date.parse('2026-12-01T08:00:00Z'));
});
