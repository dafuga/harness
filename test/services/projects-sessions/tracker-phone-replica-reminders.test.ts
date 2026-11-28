import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { hub } from './trackerPhoneFixture';
import type { ReminderRow } from './tracker-phone-replica-reminders.types';
import type { LifecycleFixture } from './tracker-phone-replica-lifecycle.types';

// Within fourteen days of the fixture's clock (23 Nov 2026), which the replica lists by.
const armed = '2026-11-29T10:00:00.000Z';
const personal = {
	title: 'Water the sample plant',
	status: 'open',
	agent: 'personal',
	kind: 'reminder',
	every: '0 10 * * 0',
	every_tz: 'UTC',
	remind_at: armed,
	needs_daniel: 1,
	resolved: 0,
	question: 'Still wanted?',
	options: JSON.stringify([
		{ label: 'Yes', effect: 'Keeps it.', recommended: true },
		{ label: 'No', effect: 'Stops it.' }
	])
};

async function current(fixture: LifecycleFixture): Promise<ReminderRow> {
	return (await (await fixture.pull()).json()).rows[0] as ReminderRow;
}

function tap(fixture: LifecycleFixture, action: string, text: string, seen: ReminderRow) {
	const intentId = `00000000-0000-4000-8000-${action === 'done' ? '1' : '2'}${seen.attentionRevision.slice(0, 11)}`;
	const revision = seen.attentionRevision;
	return fixture.write({ intentId, action, text, revision, expectedStatus: seen.status });
}

test('a personal item travels as a reminder without Needs you choices', async () => {
	const fixture = hub();
	try {
		fixture.item('fixture001', personal);
		const row = await current(fixture);
		expect(row.reminder).toEqual({ at: armed, repeats: 'Weekly', group: 'personal' });
		expect(row.flag?.options).toBeUndefined();
	} finally {
		fixture.db.close();
	}
});

test('a phone snooze moves the reminder, and an earlier done no longer applies', async () => {
	const fixture = hub();
	try {
		fixture.item('fixture001', { ...personal, needs_daniel: 0, question: null, options: null });
		const seen = await current(fixture);
		const until = '2026-11-30T09:00:00.000Z';
		expect(await (await tap(fixture, 'remind', until, seen)).json()).toMatchObject({
			status: 'accepted'
		});
		expect((await current(fixture)).reminder?.at).toBe(until);
		expect(await (await tap(fixture, 'done', '', seen)).json()).toMatchObject({
			status: 'conflict',
			reason: 'attention'
		});
		const moved = await current(fixture);
		expect(await (await tap(fixture, 'done', '', moved)).json()).toMatchObject({
			status: 'accepted'
		});
		expect(await current(fixture)).toMatchObject({
			status: 'open',
			reminder: { at: '2026-12-06T10:00:00.000Z' }
		});
	} finally {
		fixture.db.close();
	}
});

test('a work item Daniel owns travels as a work reminder; an agent ETA does not', async () => {
	const fixture = hub();
	try {
		const due = '2026-12-01T10:00:00.000Z';
		fixture.item('fixture001', { title: 'Sample', status: 'open', agent: 'vaulta', due });
		expect((await current(fixture)).reminder).toBeUndefined();
		fixture.item('fixture001', { owner: 'Daniel' });
		expect((await current(fixture)).reminder).toMatchObject({ group: 'work', due, at: due });
		fixture.item('fixture001', { auto: 'sample-launch-token' });
		expect((await current(fixture)).reminder).toBeUndefined();
	} finally {
		fixture.db.close();
	}
});
