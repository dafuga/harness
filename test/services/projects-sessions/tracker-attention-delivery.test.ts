import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import {
	chief,
	clock,
	eventId,
	fixtureItem,
	measureTick,
	minute,
	notificationFixture,
	start,
	wire,
	worker
} from './tracker-notification/fixture';

function seedPausedAttention(f: ReturnType<typeof notificationFixture>, night: number): void {
	f.rows.set('a', fixtureItem('a', { status: 'done', notes: 'Fixture result' }));
	f.rows.set(
		'b',
		fixtureItem('b', { status: 'blocked', blocked_reason: 'Fixture blocker', needs_daniel: 1 })
	);
	f.rows.set('c', fixtureItem('c', { needs_daniel: 1, question: 'Fixture question' }));
	f.rows.set(
		'd',
		fixtureItem('d', { every: '0 23 * * *', occurrence: 'current', agent: 'fixture-agent' })
	);
	f.ops.push(
		{
			seq: 1,
			item_id: 'a',
			hlc: clock(night),
			node: 'fixture-peer',
			actor: null,
			fields: { status: 'done' }
		},
		{
			seq: 2,
			item_id: 'b',
			hlc: clock(night),
			node: 'fixture-peer',
			actor: null,
			fields: { status: 'blocked', needs_daniel: 1 }
		},
		{
			seq: 3,
			item_id: 'c',
			hlc: clock(night),
			node: 'fixture-peer',
			actor: null,
			fields: { needs_daniel: 1 }
		}
	);
	f.service.enqueue({
		kind: 'recurring_due',
		itemId: 'd',
		key: 'recurring|d|current',
		at: night,
		payload: { occurrence: 'current', every: '0 23 * * *' }
	});
}

test('pause and resume release one relevant Chief of Staff batch, with recurring agent wake-ups while paused', async () => {
	let uncertain = true;
	const f = notificationFixture({
		send: async (request) => {
			if (request.destination.id === chief.id && uncertain) {
				uncertain = false;
				throw new Error('synthetic acknowledgement lost');
			}
			return { status: 'sent' };
		}
	});
	const night = start + 180 * minute;
	await f.service.tick();
	await f.service.pause('fixture-operator');
	f.at(night);

	seedPausedAttention(f, night);

	await f.service.tick();
	expect(f.calls.map((call) => call.destination)).toEqual([worker]);
	expect(wire(f.calls[0]).recurring_due).toMatchObject([{ item_id: 'd', occurrence: 'current' }]);

	f.rows.set('c', { ...f.rows.get('c')!, resolved: 1 });
	await f.restart().resume();
	expect(f.queue.read().lastAttentionError).toBe('Error');
	expect(f.calls.map((call) => call.destination)).toEqual([worker, chief]);
	const id = eventId(`done|a|${clock(night)}`, `blocked|b|${clock(night)}`);
	expect(wire(f.calls[1])).toMatchObject({
		event_id: id,
		catch_up: true,
		window_minutes: 30,
		counts: { needs_daniel: 0, blocked: 1, done: 1 },
		items: expect.arrayContaining([
			expect.objectContaining({ event: 'blocked', item_id: 'b', needs_daniel: true })
		])
	});
	expect(f.queue.read().attention.get(`flag|c|${clock(night)}`)?.status).toBe('dropped');
	await f.service.pause('fixture-operator');
	await f.restart().tick();
	expect(f.calls).toHaveLength(2);
	await f.restart().resume();
	expect(f.calls[2]).toEqual(f.calls[1]);
	await f.restart().tick();
	expect(f.calls).toHaveLength(3);
});

test('tick sends an overnight ask to Chief of Staff and retries the batch on the next window', async () => {
	let rejected = false;
	const f = notificationFixture({
		send: async () => {
			if (rejected) return { status: 'sent' };
			rejected = true;
			return { status: 'rejected', error: 'HTTP 503' };
		}
	});
	await f.service.tick();
	f.rows.set('a', fixtureItem('a', { needs_daniel: 1, question: 'Fixture question' }));
	f.ops.push({
		seq: 1,
		item_id: 'a',
		hlc: clock(),
		node: 'fixture-peer',
		actor: 'fixture-operator',
		fields: { needs_daniel: 1 }
	});
	await f.service.tick();
	const night = start + 180 * minute;
	f.at(night);
	await f.restart().tick();
	expect(f.queue.read().lastAttentionError).toBe('HTTP 503');
	f.at(night + 29 * minute);
	await f.service.tick();
	expect(f.calls).toHaveLength(1);

	f.at(night + 30 * minute);
	await measureTick(f.restart(), 'quiet-hour-batch');
	const id = eventId(`flag|a|${clock()}`);
	expect(f.calls.map((call) => call.id)).toEqual([id, id]);
	expect(f.queue.read().attention.get(`flag|a|${clock()}`)).toMatchObject({
		status: 'sent',
		batchId: id
	});
	expect(f.queue.read().lastAttentionError).toBeUndefined();
});

test('enqueue keeps only the latest unsent launch-wait text and drops waits with superseded tokens', async () => {
	const f = notificationFixture();
	f.at(start + 5 * minute);
	f.rows.set('waiting', fixtureItem('waiting', { auto: 'fixture-token' }));
	f.rows.set('stale', fixtureItem('stale', { auto: 'old-token' }));
	f.service.enqueue({
		kind: 'launch_wait',
		itemId: 'waiting',
		computer: 'fixture-computer',
		reason: 'first reason'
	});
	f.service.enqueue({
		kind: 'launch_wait',
		itemId: 'stale',
		computer: 'fixture-computer',
		reason: 'stale reason'
	});
	f.at(start + 15 * minute);
	f.service.enqueue({
		kind: 'launch_wait',
		itemId: 'waiting',
		computer: 'fixture-computer',
		reason: 'latest reason'
	});
	f.rows.set('stale', { ...f.rows.get('stale')!, auto: 'new-token' });
	await f.service.tick();
	expect(f.calls).toHaveLength(0);

	f.at(start + 30 * minute);
	await f.restart().tick();
	const id = eventId('launch_wait|waiting|fixture-token');
	expect(wire(f.calls[0])).toMatchObject({
		event_id: id,
		counts: { launch_wait: 1 },
		text: 'LAUNCH WAITING: Fixture waiting on fixture-computer - latest reason'
	});
	expect(f.queue.read().attention.get('launch_wait|stale|old-token')?.status).toBe('dropped');
});
