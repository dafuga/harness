import { expect, test } from 'vitest';
import {
	chief,
	clock,
	fixtureItem,
	minute,
	notificationFixture,
	start,
	wire
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
	const night = start + 180 * minute;
	const release = Date.parse('2026-02-03T08:00:00Z');
	f.at(night);
	f.rows.set(
		'flag',
		fixtureItem('flag', {
			needs_daniel: 1,
			question: 'Fixture question',
			clocks: { needs_daniel: clock(night) }
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
	await f.restart().tick();
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
	f.at(release + 65 * minute);
	await f.service.tick();
	expect(wire(f.calls[2])).toMatchObject({
		new: [],
		reminders: [{ id: 'flag', reminder_number: 1 }]
	});
	f.rows.set('flag', { ...f.rows.get('flag')!, resolved: 1 });
	f.at(release + 125 * minute);
	await f.service.tick();
	expect(f.calls).toHaveLength(3);
	expect([...f.queue.read().reminders.values()].map((r) => r.status)).toEqual(['closed', 'closed']);
});

test('tick coalesces legacy webhook escalations after a block and closes them on answer', async () => {
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

	f.at(start + 60 * minute);
	await f.restart().tick();
	expect(wire(f.calls[2]).items).toMatchObject([
		{ event: 'needs_daniel', escalation: 1, item_id: 'block' },
		{ event: 'needs_daniel', escalation: 1, item_id: 'flag' }
	]);
	f.rows.set('block', { ...f.rows.get('block')!, resolved: 1 });
	f.rows.set('flag', { ...f.rows.get('flag')!, resolved: 1 });
	f.at(start + 120 * minute);
	await f.service.tick();
	expect(f.calls).toHaveLength(3);
	expect([...f.queue.read().flags.values()].map((row) => row.status)).toEqual(['closed', 'closed']);
});
