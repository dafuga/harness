import { expect, test } from 'vitest';
import { planTrackerItemMutation as plan } from '../../../src/utils/projects-sessions/planTrackerItemMutation';
import { context, item } from './trackerItemFixture';

// The fixture clock is 2026-07-02. Sundays 10:00 Lisbon are 09:00 UTC in summer.
const weekly = '0 10 * * 0';
const reminder = {
	...item,
	kind: 'reminder',
	status: 'open',
	every: weekly,
	every_tz: 'Europe/Lisbon',
	remind_at: '2026-07-05T09:00:00.000Z'
};

test('a repeating reminder with no time is armed at its next scheduled one', () => {
	const body = { title: 'Water the sample plant', kind: 'reminder', every: weekly };
	expect(plan({ action: 'add', itemId: item.id, body }, context).fields).toMatchObject({
		kind: 'reminder',
		every: weekly,
		every_tz: 'Europe/Lisbon',
		remind_at: '2026-07-05T09:00:00.000Z',
		auto: null,
		schedule_off: 1
	});
});

test('done arms the following time, and done early skips the armed one', () => {
	const done = plan({ action: 'done', item: reminder }, context).fields;
	expect(done.remind_at).toBe('2026-07-12T09:00:00.000Z');
	expect(done.status).toBeUndefined();
});

test('done long after the armed time arms the next future one', () => {
	const late = { ...reminder, remind_at: '2026-06-07T09:00:00.000Z' };
	expect(plan({ action: 'done', item: late }, context).fields.remind_at).toBe(
		'2026-07-05T09:00:00.000Z'
	);
});

test('a second tap that still names the old time is refused', () => {
	const moved = { ...reminder, remind_at: '2026-07-12T09:00:00.000Z' };
	const body = { occurrence: reminder.remind_at };
	expect(() => plan({ action: 'done', item: moved, body }, context)).toThrow('already moved');
});

test('snooze moves only this time and keeps the schedule', () => {
	const at = '2026-07-06T08:00:00.000Z';
	expect(plan({ action: 'remind', item: reminder, body: { at } }, context).fields).toEqual({
		remind_at: at
	});
});

test('removing the schedule lets done end the reminder', () => {
	const once = { ...reminder, every: null };
	expect(plan({ action: 'done', item: once }, context).fields).toMatchObject({
		status: 'done',
		remind_at: null
	});
});
