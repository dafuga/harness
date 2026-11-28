import { expect, test } from 'vitest';
import { trackerUpcomingReminder } from '../../../src/utils/projects-sessions/trackerUpcomingReminder';
import {
	trackerPersonalName,
	trackerReminderName
} from '../../../src/utils/projects-sessions/trackerReminderName';

const now = Date.parse('2026-11-28T17:00:00Z');
const todo = { status: 'open', agent: 'personal', title: 'Sample to-do' };
const upcoming = (fields: object) => trackerUpcomingReminder({ ...todo, ...fields }, now);

// The shape of the real item Daniel named: its reminder has passed and it is due within a week.
const snacks = {
	title:
		'Reminder Sat 28 Nov 10:00 Lisbon: get the snacks from Sintra and Porto (Daniel 26 Nov; personal, chat-only)',
	remindAt: '2026-11-28T10:00:00.000Z',
	due: '2026-12-05T10:00:00.000Z'
};

test('a to-do whose reminder passed is listed by its coming deadline, not as overdue', () => {
	expect(upcoming(snacks)).toEqual({
		at: snacks.due,
		repeats: null,
		group: 'personal',
		due: snacks.due
	});
	expect(trackerPersonalName(snacks.title)).toBe('Get the snacks from Sintra and Porto');
});

test('a snooze moves the row, even past the deadline', () => {
	const remindAt = '2026-12-06T09:00:00.000Z';
	expect(upcoming({ ...snacks, remindAt })).toMatchObject({ at: remindAt, due: snacks.due });
});

test('fourteen days ahead is upcoming and any passed time stays listed', () => {
	expect(upcoming({ due: '2026-12-12T16:00:00.000Z' })).toBeDefined();
	expect(upcoming({ due: '2026-12-13T00:00:00.000Z' })).toBeUndefined();
	expect(upcoming({ due: '2026-01-02T10:00:00.000Z' })?.at).toBe('2026-01-02T10:00:00.000Z');
	expect(upcoming({})).toBeUndefined();
});

test('a due day lasts until the end of that day in Lisbon', () => {
	expect(upcoming({ due: '2026-11-28' })).toMatchObject({
		at: '2026-11-28T23:59:00.000Z',
		allDay: true
	});
});

test('a repeating reminder keeps its armed time, which done names', () => {
	const remindAt = '2026-11-27T10:00:00.000Z';
	const fields = { remindAt, every: '0 10 * * *', due: '2026-12-01T10:00:00.000Z' };
	expect(upcoming(fields)).toMatchObject({ at: remindAt, repeats: 'Daily' });
});

test("Daniel's agents are personal, whoever launches them", () => {
	for (const agent of ['personal', 'dad', 'doc', 'claire', 'boating', 'coach', 'life-coach'])
		expect(upcoming({ agent, due: snacks.due, autoLaunch: true })?.group).toBe('personal');
});

test("work is listed only when it is Daniel's to do", () => {
	const work = { agent: 'vaulta', due: snacks.due };
	expect(upcoming(work)).toBeUndefined();
	expect(upcoming({ ...work, owner: 'Chief of Staff', remindAt: snacks.due })).toBeUndefined();
	expect(upcoming({ ...work, owner: 'Daniel' })?.group).toBe('work');
	expect(upcoming({ ...work, kind: 'reminder' })?.group).toBe('work');
	expect(upcoming({ ...work, title: 'Reminder Mon: check approvals' })?.group).toBe('work');
	// An auto-launched item's due time is the agent's ETA.
	expect(upcoming({ ...work, owner: 'Daniel', autoLaunch: true })).toBeUndefined();
});

test('finished, ignored and scheduled-job items are never reminders', () => {
	for (const fields of [{ status: 'done' }, { status: 'ignored' }, { kind: 'recurring' }])
		expect(upcoming({ ...snacks, ...fields })).toBeUndefined();
});

test('a personal name leaves asides and notes to Chief of Staff on the item', () => {
	expect(
		trackerPersonalName(
			"WEEKLY personal reminder (Sundays 17:00 Lisbon): shave + clip nails (Daniel 26 Nov). CoS: after reminding, re-arm (see 'note (x)')"
		)
	).toBe('Shave + clip nails');
	// The phone copy can cut a title inside a bracket.
	expect(trackerPersonalName('Call the sample clinic (details in the sam')).toBe(
		'Call the sample clinic'
	);
	expect(trackerReminderName('Reminder 3 Dec 10:00: send it (v2)')).toBe('Send it (v2)');
});
