import { expect, test } from 'vitest';
import { planTrackerItemMutation as plan } from '../../../src/utils/projects-sessions/planTrackerItemMutation';
import { measureWorkload } from '../../support/measureWorkload';
import { context, item, now } from './trackerItemFixture';

const unit = 'function.projects-sessions-plan-tracker-item-mutation';

test('add emits Store defaults, API aliases and a receipt for the caller to commit', () =>
	measureWorkload(unit, 'add-item-with-receipt', () => {
		const receipt = Object.freeze({ source_id: 'fixture', external_id: '123', event_id: '456' });
		const body = Object.freeze({
			title: '  Record synthetic delivery  ',
			due: 'tomorrow',
			question: ' Ready? ',
			callback_url: 'https://callback.example.test/fixture',
			callback_cmd: 'record-fixture',
			created_by: 'not-an-api-field'
		});
		expect(plan({ action: 'add', itemId: item.id, body, receipt }, context)).toEqual({
			itemId: item.id,
			fields: {
				kind: 'task',
				status: 'open',
				needs_daniel: 1,
				resolved: 0,
				deleted: 0,
				created_at: now,
				created_by: 'fixture-node',
				title: 'Record synthetic delivery',
				due: '2026-07-03',
				question: 'Ready?',
				callback: '{"cmd":"record-fixture","node":"fixture-node"}'
			},
			receipt
		});
	}));

test('update appends a separate note and removes recurring metadata when requested', () => {
	const recurring = { ...item, kind: 'recurring', every: '@daily', occurrence: now };
	expect(
		plan(
			{
				action: 'update',
				item: recurring,
				body: { every: 'none', note: 'ignored input field', append_note: '  preserve spacing  ' }
			},
			context
		)
	).toEqual({
		itemId: item.id,
		fields: {
			every: null,
			occurrence: null,
			missed: null,
			kind: 'task',
			'note+': '  preserve spacing  '
		}
	});
	expect(plan({ action: 'update', item, body: { every: ' @DAILY ' } }, context).fields).toEqual({
		every: '@DAILY',
		kind: 'recurring',
		every_tz: 'Europe/Lisbon'
	});
});

test('start, progress and note emit only the fields for the requested transition', () => {
	expect(plan({ action: 'start', item }, context).fields).toEqual({ status: 'in_progress' });
	expect(
		plan({ action: 'progress', item, body: { text: 'Queue drained' } }, context).fields
	).toEqual({
		status: 'in_progress',
		'note+': 'Queue drained'
	});
	expect(plan({ action: 'note', item, body: { text: '  followup  ' } }, context).fields).toEqual({
		'note+': '  followup  '
	});
});

test('answer, unflag and resolve cancel even a reminder whose journal entry has yet to sync', () => {
	expect(plan({ action: 'flag', item, body: { question: '  Proceed? ' } }, context).fields).toEqual(
		{
			needs_daniel: 1,
			resolved: 0,
			question: 'Proceed?'
		}
	);
	expect(plan({ action: 'flag', item }, context).fields).toEqual({ needs_daniel: 1, resolved: 0 });
	expect(plan({ action: 'unflag', item }, context).fields).toEqual({
		needs_daniel: 0,
		remind_at: null
	});
	expect(
		plan(
			{ action: 'answer', item, body: { answer: '  yes  ', by: ' fixture operator ', done: true } },
			context
		).fields
	).toEqual({
		resolved: 1,
		needs_daniel: 0,
		answered_at: now,
		answered_by: 'fixture operator',
		remind_at: null,
		answer: 'yes',
		status: 'done'
	});
	expect(plan({ action: 'resolve', item }, context).fields).toEqual({
		resolved: 1,
		needs_daniel: 0,
		answered_at: now,
		answered_by: 'daniel',
		remind_at: null
	});
});

test('done finishes ordinary items and records recurring outcomes against the fixed clock', () => {
	expect(plan({ action: 'done', item, body: { note: 'Complete' } }, context).fields).toEqual({
		status: 'done',
		remind_at: null,
		'note+': 'Complete'
	});
	const recurring = {
		...item,
		status: 'in_progress',
		every: '@daily',
		every_tz: 'America/New_York'
	};
	expect(
		plan(
			{
				action: 'done',
				item: recurring,
				body: { failed: true, occurrence: '2026-06-30T23:00:00-04:00', note: 'Needs retry' }
			},
			context
		).fields
	).toEqual({
		last_result: JSON.stringify({
			occurrence: '2026-07-01T03:00:00.000Z',
			status: 'failed',
			at: now,
			by: 'fixture-node',
			note: 'Needs retry'
		}),
		status: 'open',
		'note+': 'occurrence 2026-06-30 23:00 failed: Needs retry'
	});
});

test('ignore records the previous status and unignore restores it with a pending flag', () => {
	expect(
		plan({ action: 'ignore', item, body: { reason: '  defer  ', until: 'today' } }, context).fields
	).toEqual({
		status: 'ignored',
		remind_at: null,
		ignored_reason: 'defer',
		ignored_by: 'unknown',
		ignored_at: now,
		ignored_until: '2026-07-02',
		ignored_prev_status: 'blocked',
		'note+': 'ignored by unknown: defer; until 2026-07-02'
	});
	const ignored = { ...item, status: 'ignored', ignored_prev_status: 'blocked', resolved: 0 };
	expect(
		plan({ action: 'unignore', item: ignored, body: { by: 'operator', note: 'resumed' } }, context)
			.fields
	).toEqual({
		status: 'blocked',
		ignored_until: null,
		needs_daniel: 1,
		'note+': 'unignored by operator: resumed; back to blocked'
	});
});

test('done refuses an unanswered Daniel decision unless forced, but never a ping or an answered flag', () => {
	const asked = { ...item, status: 'in_progress', needs_daniel: 1, resolved: 0, question: 'Approve?' };
	expect(() => plan({ action: 'done', item: asked, body: { note: 'x' } }, context)).toThrow(
		/unanswered flag for Daniel/
	);
	expect(plan({ action: 'done', item: asked, body: { force: true } }, context).fields).toMatchObject({
		status: 'done'
	});
	const ping = {
		...asked,
		question: 'host: Session auto-a-r1 is idle again after a watchdog check-in. Chief of Staff, please inspect the session.'
	};
	expect(plan({ action: 'done', item: ping, body: {} }, context).fields).toMatchObject({
		status: 'done'
	});
	expect(plan({ action: 'done', item: { ...asked, resolved: 1 }, body: {} }, context).fields).toMatchObject({
		status: 'done'
	});
});
