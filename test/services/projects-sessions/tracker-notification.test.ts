import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import type { FixtureQueue } from './tracker-notification/fixture.types';
import {
	clock,
	fixtureItem,
	memoryQueue,
	measureTick,
	minute,
	notificationFixture,
	owner,
	start,
	wire,
	worker
} from './tracker-notification/fixture';

function seedCallbacks(f: ReturnType<typeof notificationFixture>): string {
	const transition = clock();
	const callback = { ...owner, node: 'fixture-node' };
	f.rows.set(
		'a',
		fixtureItem('a', {
			status: 'done',
			resolved: 1,
			callback,
			agent: 'fixture-agent',
			clocks: { status: transition, resolved: transition }
		})
	);
	f.rows.set(
		'remote',
		fixtureItem('remote', {
			status: 'done',
			callback: { ...callback, node: 'fixture-other' },
			clocks: { status: transition }
		})
	);
	f.rows.set(
		'history',
		fixtureItem('history', {
			status: 'done',
			agent: 'fixture-agent',
			callback,
			clocks: { status: clock(start - minute - 1) }
		})
	);

	return transition;
}

test('tick groups completion at one clock, snapshots local targets and retries only the rejected callback', async () => {
	let rejected = false;
	const f = notificationFixture({
		send: async (request) => {
			if (request.destination.id === owner.id && !rejected) {
				rejected = true;
				return { status: 'rejected', error: 'exit 1' };
			}
			return { status: 'sent' };
		}
	});
	const transition = seedCallbacks(f);

	await Promise.all([f.service.tick(), f.restart().tick()]);
	expect(f.calls.map((call) => call.destination)).toEqual([owner, worker]);
	const [command, http] = f.calls;
	const key = `a|${transition}|item`;
	expect(command.id).toBe(key);
	expect(command.environment).toEqual({
		TRACKER_EVENT: 'done,resolved',
		TRACKER_ITEM_ID: 'a',
		TRACKER_PAYLOAD: command.body
	});
	expect(wire(command)).toEqual({
		type: 'item',
		events: ['done', 'resolved'],
		item: { id: 'a', title: 'Fixture a' },
		node: 'fixture-node',
		sent_at: new Date(start).toISOString()
	});
	expect(http.headers).toEqual({
		'content-type': 'application/json',
		'user-agent': 'tracker',
		'x-tracker-event': 'item'
	});
	expect(f.queue.read().callbacks.get(key)).toMatchObject({
		status: 'pending',
		attempts: 1,
		nextAt: start + 30_000,
		lastError: 'exit 1'
	});

	f.at(start + 29_999);
	await f.restart().tick();
	expect(f.calls).toHaveLength(2);
	f.at(start + 30_000);
	await f.restart().tick();
	await f.service.tick();
	expect(f.calls.map((call) => call.id)).toEqual([key, `a|${transition}|agent:fixture-agent`, key]);
	expect(f.queue.read().callbacks.get(key)).toMatchObject({
		status: 'ok',
		attempts: 2,
		lastError: null
	});
});

test('tick records distinct resolution clocks and stops callback retries after eight attempts', async () => {
	const f = notificationFixture({
		send: async () => ({ status: 'rejected', error: 'fixture unavailable' })
	});
	const done = clock();
	const resolved = clock(start + 1);
	f.rows.set(
		'a',
		fixtureItem('a', {
			status: 'done',
			resolved: 1,
			callback: { ...owner, node: 'fixture-node' },
			clocks: { status: done, resolved }
		})
	);
	for (const offset of [0, 30, 150, 750, 2550, 6150, 9750, 13350, 18000]) {
		f.at(start + offset * 1000);
		await f.service.tick();
	}
	expect(f.calls).toHaveLength(16);
	expect(f.calls.slice(0, 2).map((call) => wire(call).events)).toEqual([['done'], ['resolved']]);
	expect([...f.queue.read().callbacks.values()].map((row) => [row.status, row.attempts])).toEqual([
		['failed', 8],
		['failed', 8]
	]);
});

test('tick replays the persisted request after an accepted send and a failed outcome commit', async () => {
	const storage = memoryQueue();
	let failCommit = true;
	const queue: FixtureQueue = {
		...storage,
		update(change) {
			return storage.update((draft) => {
				const issued = draft.inFlight;
				const result = change(draft);
				if (issued && !draft.inFlight && failCommit) {
					failCommit = false;
					throw new Error('fixture outcome commit failed');
				}
				return result;
			});
		}
	};
	const receipts = new Map();
	const f = notificationFixture({
		queue,
		send: async (request) => {
			expect(storage.read().inFlight?.request).toEqual(request);
			if (!receipts.has(request.id)) receipts.set(request.id, request.body);
			return { status: 'sent' };
		}
	});
	f.rows.set(
		'a',
		fixtureItem('a', {
			status: 'done',
			callback: { ...owner, node: 'fixture-node' },
			clocks: { status: clock() }
		})
	);

	await expect(f.service.tick()).rejects.toThrow('fixture outcome commit failed');
	const issued = queue.read().inFlight?.request;
	expect(issued).toEqual(f.calls[0]);
	f.at(start + 10 * minute);
	f.rows.set('a', { ...f.rows.get('a')!, title: 'Fixture a changed since delivery' });
	await measureTick(f.restart(), 'callback-recovery');
	await f.service.tick();
	expect(f.calls).toEqual([issued, issued]);
	expect(receipts.size).toBe(1);
	expect(queue.read().inFlight).toBeUndefined();
	expect(queue.read().callbacks.get(f.calls[0].id)).toMatchObject({ status: 'ok', attempts: 1 });
});
