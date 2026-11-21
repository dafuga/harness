import { expect, test } from 'vitest';
import { nextReminderSlotAt } from '../../../src/helpers/attention-timing/nextReminderSlotAt';

const at = (iso: string) => Date.parse(iso);

test('nextReminderSlotAt picks the earliest daily slot strictly after the instant', () => {
	const slots = ['13:00', '09:00'];
	expect(nextReminderSlotAt(at('2026-11-16T09:00:00Z'), slots, 'Europe/Lisbon')).toBe(
		at('2026-11-16T13:00:00Z')
	);
	expect(nextReminderSlotAt(at('2026-11-16T10:00:00Z'), slots, 'Europe/Lisbon')).toBe(
		at('2026-11-16T13:00:00Z')
	);
});

test('nextReminderSlotAt rolls over to the next day after the last slot', () => {
	expect(nextReminderSlotAt(at('2026-11-16T14:00:00Z'), ['09:00', '13:00'], 'Europe/Lisbon')).toBe(
		at('2026-11-17T09:00:00Z')
	);
});

test('nextReminderSlotAt ignores duplicate slots and rejects an empty list', () => {
	expect(nextReminderSlotAt(at('2026-11-16T08:00:00Z'), ['09:00', '09:00'], 'Europe/Lisbon')).toBe(
		at('2026-11-16T09:00:00Z')
	);
	expect(() => nextReminderSlotAt(at('2026-11-16T08:00:00Z'), [], 'Europe/Lisbon')).toThrow(
		'reminderTimes is empty'
	);
});
