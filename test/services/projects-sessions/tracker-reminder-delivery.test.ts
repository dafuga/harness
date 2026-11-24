import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import {
	chief,
	clock,
	fixtureItem,
	measureTick,
	minute,
	notificationFixture,
	start,
	wire,
	verifyDirectFollowUps
} from './tracker-notification/fixture';

test('tick holds direct reminders through quiet hours, groups once, and repeats only active flags after retry', async () => {
	let rejected = false;
	const f = notificationFixture({
		options: { chiefOfStaff: chief, webhook: undefined },
		send: async () => {
			if (rejected) return { status: 'sent' };
			rejected = true;
			return { status: 'rejected', error: 'HTTP 503' };
		}
	});
	const release = Date.parse('2026-02-03T08:00:00Z');
	f.at(start + 180 * minute);
	f.rows.set(
		'flag',
		fixtureItem('flag', {
			needs_daniel: 1,
			question: 'Fixture question',
			clocks: { needs_daniel: clock(start + 180 * minute) }
		})
	);
	f.rows.set('due', fixtureItem('due', { due: '2026-02-02', clocks: { due: clock() } }));
	await f.service.tick();
	expect(f.calls).toHaveLength(0);
	expect([...f.queue.read().reminders.values()].map((r) => r.nextAt)).toEqual([release, release]);

	f.at(release);
	await f.restart().tick();
	expect(f.calls).toHaveLength(1);
	expect([...f.queue.read().reminders.values()].map((r) => [r.pings, r.nextAt])).toEqual([
		[0, release + 5 * minute],
		[0, release + 5 * minute]
	]);

	f.at(release + 5 * minute);
	await measureTick(f.restart(), 'grouped-reminders');
	expect(f.calls.map((call) => call.id)).toEqual([f.calls[0].id, f.calls[0].id]);
	expect(wire(f.calls[1])).toMatchObject({
		type: 'attention',
		digest: { fixture: true },
		reminders: [],
		new: [
			{ id: 'flag', reminder_number: 0, reason: 'needs_daniel' },
			{ id: 'due', reminder_number: 0, reason: 'due' }
		]
	});
	await verifyDirectFollowUps(f, release + 5 * minute);
});

test('tick delivers the current explicit reminder once at its timestamp across restarts and quiet hours', async () => {
	let uncertain = true;
	const f = notificationFixture({
		options: { chiefOfStaff: chief },
		send: async () => {
			if (uncertain) {
				uncertain = false;
				throw new Error('synthetic lost acknowledgement');
			}
			return { status: 'sent' };
		}
	});
	const night = start + 180 * minute;
	const wake = night + 2 * minute;
	const snooze = (at: number) => new Date(at).toISOString();
	f.rows.set(
		'delayed',
		fixtureItem('delayed', {
			status: 'blocked',
			question: 'Approve the fixture?',
			needs_daniel: 1,
			remind_at: snooze(night),
			clocks: { needs_daniel: clock(), remind_at: clock(start + 1) }
		})
	);
	await f.service.tick();
	expect(f.calls).toHaveLength(0);

	f.rows.set('delayed', {
		...f.rows.get('delayed')!,
		remind_at: snooze(wake),
		clocks: { needs_daniel: clock(), remind_at: clock(start + 2) }
	});
	f.rows.set(
		'cancelled',
		fixtureItem('cancelled', {
			status: 'done',
			remind_at: snooze(wake),
			clocks: { remind_at: clock(start + 2) }
		})
	);
	f.at(wake - 1);
	await f.restart().tick();
	expect(f.calls).toHaveLength(0);

	f.at(wake);
	await expect(f.restart().tick()).rejects.toThrow('synthetic lost acknowledgement');
	expect(f.calls).toHaveLength(1);
	const parkedUntil = wake + 10 * minute;
	f.rows.set('delayed', { ...f.rows.get('delayed')!, parked_until: snooze(parkedUntil) });
	f.at(parkedUntil - 1);
	await f.restart().tick();
	expect(f.calls).toHaveLength(1);
	f.at(parkedUntil);
	await measureTick(f.restart(), 'explicit-reminder-at-wake');
	expect(f.calls.map(({ id }) => id)).toEqual([f.calls[0].id, f.calls[0].id]);
	expect(wire(f.calls[1])).toMatchObject({
		type: 'attention',
		new: [
			{
				id: 'delayed',
				reason: 'remind_at',
				remind_at: snooze(wake),
				question: 'Approve the fixture?'
			}
		]
	});
	await f.restart().tick();
	expect(f.calls).toHaveLength(2);
});

test('tick sends a scheduled reminder through a webhook when it is the only hub destination', async () => {
	const f = notificationFixture();
	const wake = start + minute;
	const at = new Date(wake).toISOString();
	f.rows.set('wake', fixtureItem('wake', { remind_at: at, clocks: { remind_at: clock() } }));
	await f.service.tick();
	expect(f.calls).toHaveLength(0);
	f.at(wake);
	await f.restart().tick();
	await f.service.tick();
	expect(f.calls).toHaveLength(1);
	expect(wire(f.calls[0])).toMatchObject({
		event: 'attention',
		to: 'chief_of_staff',
		items: [{ item_id: 'wake', reason: 'remind_at', remind_at: at }]
	});
});

test('tick follows up webhook asks on their own cadence and closes them on answer', async () => {
	const f = notificationFixture();
	f.options.webhook = { destination: chief, batch: false, coalesceMinutes: 10 };
	await f.service.tick();
	const at = clock(start);
	f.rows.set(
		'block',
		fixtureItem('block', {
			status: 'blocked',
			needs_daniel: 1,
			clocks: { status: at, needs_daniel: at }
		})
	);
	f.ops.push({
		seq: 1,
		item_id: 'block',
		hlc: at,
		node: 'fixture-peer',
		actor: null,
		fields: { status: 'blocked', needs_daniel: 1 }
	});
	await f.service.tick();
	expect(wire(f.calls[0]).items).toMatchObject([{ event: 'blocked', item_id: 'block' }]);

	f.at(start + 8 * minute);
	f.rows.set(
		'flag',
		fixtureItem('flag', { needs_daniel: 1, clocks: { needs_daniel: clock(start + 8 * minute) } })
	);
	await f.service.tick();
	expect(wire(f.calls[1]).items).toMatchObject([
		{ event: 'needs_daniel', escalation: 0, item_id: 'flag' }
	]);

	f.at(start + 119 * minute);
	await f.restart().tick();
	expect(f.calls).toHaveLength(2);
	const morning = Date.parse('2026-02-03T08:00:00Z');
	f.at(morning);
	await f.restart().tick();
	expect(wire(f.calls[2]).items).toMatchObject([
		{ event: 'needs_daniel', escalation: 1, item_id: 'block', waiting_minutes: 720 },
		{ event: 'needs_daniel', escalation: 1, item_id: 'flag', waiting_minutes: 712 }
	]);
	f.rows.set('block', { ...f.rows.get('block')!, resolved: 1 });
	f.rows.set('flag', { ...f.rows.get('flag')!, resolved: 1 });
	f.at(morning + 360 * minute);
	await f.service.tick();
	expect(f.calls).toHaveLength(3);
	expect([...f.queue.read().flags.values()].map((row) => row.status)).toEqual(['closed', 'closed']);
});

test('tick drops a held flag after answer and schedules the surviving flag at the next configured slot', async () => {
	const f = notificationFixture();
	f.options.webhook = { destination: chief, batch: false, reminderTimes: ['09:00', '13:00'] };
	const night = start + 180 * minute;
	f.at(night);
	for (const id of ['answered', 'waiting']) {
		f.rows.set(id, fixtureItem(id, { needs_daniel: 1, clocks: { needs_daniel: clock(night) } }));
	}
	await f.service.tick();
	expect(f.calls).toHaveLength(0);

	f.rows.set('answered', { ...f.rows.get('answered')!, resolved: 1 });
	const release = Date.parse('2026-02-03T08:00:00Z');
	f.at(release);
	await f.restart().tick();
	expect(wire(f.calls[0]).items).toMatchObject([
		{ event: 'needs_daniel', item_id: 'waiting', escalation: 0 }
	]);
	expect(f.queue.read().flags.get(`waiting|${clock(night)}`)?.nextAt).toBe(release + 60 * minute);
	expect(f.queue.read().flags.get(`answered|${clock(night)}`)?.status).toBe('closed');

	f.at(release + 60 * minute);
	await f.restart().tick();
	expect(wire(f.calls[1]).items).toMatchObject([{ item_id: 'waiting', escalation: 1 }]);
	expect(f.queue.read().flags.get(`waiting|${clock(night)}`)?.nextAt).toBe(release + 300 * minute);
});
