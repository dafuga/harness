import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import {
	chief,
	clock,
	eventId,
	fixtureItem,
	measureTick,
	notificationFixture,
	start,
	wire,
	worker
} from './tracker-notification/fixture';

function addOwnerChanges(f: ReturnType<typeof notificationFixture>): string {
	const changed = clock(start + 1);
	f.ops.push(
		{
			seq: 2,
			item_id: 'a',
			hlc: changed,
			node: 'fixture-peer',
			actor: 'fixture-other',
			fields: { due: null }
		},
		{
			seq: 3,
			item_id: 'a',
			hlc: clock(start + 2),
			node: 'fixture-peer',
			actor: ' fixture-alias ',
			fields: { due: null }
		},
		{
			seq: 4,
			item_id: 'a',
			hlc: clock(start + 3),
			node: 'fixture-peer',
			actor: 'fixture-other',
			fields: { 'note+': 'fixture note' }
		}
	);
	return changed;
}

function expectedOwnerBatch(id: string) {
	return {
		event_id: id,
		event: 'attention',
		to: 'fixture-agent',
		count: 1,
		node: 'fixture-node',
		counts: {
			blocked: 0,
			needs_daniel_new: 0,
			reminders: 0,
			due: 0,
			recurring_due: 0,
			done: 0,
			resolved: 0,
			changed: 1,
			blocked_no_daniel: 0
		},
		items: [
			{
				event_id: id,
				event: 'changed',
				item_id: 'a',
				title: 'Fixture a',
				kind: 'task',
				status: 'open',
				needs_daniel: false,
				owner: ' Fixture-Alias ',
				waiter: 'fixture-agent',
				agent: 'fixture-agent',
				escalation: 0,
				blocked_reason: null,
				question: null,
				answer: null,
				due: null,
				changed_fields: ['due'],
				node: 'fixture-node',
				occurred_at: new Date(start + 1).toISOString()
			}
		],
		recurring_due: [],
		sent_at: new Date(start).toISOString(),
		attempt: 1
	};
}

test('tick seeds its cursor and routes one stable owner batch while suppressing self changes and note-only changes', async () => {
	const f = notificationFixture();
	const at = clock();
	f.rows.set('a', fixtureItem('a', { agent: 'fixture-agent', owner: ' Fixture-Alias ' }));
	f.ops.push({
		seq: 1,
		item_id: 'a',
		hlc: at,
		node: 'fixture-peer',
		actor: 'fixture-other',
		fields: { status: 'done' }
	});
	await f.service.tick();
	expect(f.queue.read().cursor).toBe(1);
	expect(f.calls).toHaveLength(0);

	const changed = addOwnerChanges(f);

	await measureTick(f.restart(), 'owner-routing');
	await f.service.tick();
	expect(f.calls).toHaveLength(1);
	const [call] = f.calls;
	const id = eventId(`changed|a|${changed}`);
	expect(call.destination).toEqual(worker);
	expect(call.headers?.['x-tracker-event-id']).toBe(id);
	expect(wire(call)).toEqual(expectedOwnerBatch(id));
	expect(f.queue.read().cursor).toBe(4);
});

test('tick backs off rejected groups, joins new work on retry and discards superseded recurring wake-ups', async () => {
	let sends = 0;
	const f = notificationFixture({
		send: async () =>
			++sends === 1 ? { status: 'rejected', error: 'HTTP 503' } : { status: 'sent' }
	});
	f.options.webhook = { destination: chief, batch: false };
	f.rows.set('a', fixtureItem('a', { due: '2026-02-02', clocks: { due: clock() } }));
	await f.service.tick();
	const a = `due|a|${clock()}`;
	expect(f.queue.read().outbox.get(a)).toMatchObject({
		status: 'pending',
		attempts: 1,
		nextAt: start + 30_000
	});

	f.at(start + 29_999);
	await f.restart().tick();
	expect(f.calls).toHaveLength(1);

	f.at(start + 30_000);
	f.rows.set('b', fixtureItem('b', { due: '2026-02-02', clocks: { due: clock() } }));
	f.rows.set('c', fixtureItem('c', { every: '0 23 * * *', occurrence: 'newer' }));
	f.service.enqueue({
		kind: 'recurring_due',
		itemId: 'c',
		key: 'recurring|c|old',
		at: start,
		payload: { occurrence: 'older' }
	});
	await f.restart().tick();
	const b = `due|b|${clock()}`;
	expect(f.calls.map((call) => call.id)).toEqual([eventId(a), eventId(a, b)]);
	expect(wire(f.calls[1])).toMatchObject({
		attempt: 2,
		items: [{ item_id: 'a' }, { item_id: 'b' }]
	});
	expect(f.queue.read().outbox.get('recurring|c|old')).toMatchObject({
		status: 'dropped',
		lastError: 'superseded'
	});
	await f.service.tick();
	expect(f.calls).toHaveLength(2);
});

test('tick on a spoke leaves queued webhook and reminder escalation work for the hub', async () => {
	const f = notificationFixture({ options: { role: 'spoke' } });
	f.rows.set('a', fixtureItem('a', { needs_daniel: 1, due: '2026-02-02' }));
	f.service.enqueue({ kind: 'autolaunch', key: 'fixture-summary', payload: {} });
	await f.service.tick();
	expect(f.calls).toHaveLength(0);
	expect(f.queue.read()).toMatchObject({ cursor: null, outbox: new Map(), flags: new Map() });
});
