import { describe, expect, it, vi } from 'vitest';
import { phoneTrackerInboxSource } from '../../src/lib/development-tooling/tracker-inbox/phoneTrackerInboxSource';
import { reminderWrite } from '../../src/lib/development-tooling/tracker-inbox/trackerReminders';
import type { PhoneTrackerTools } from '../../src/models/development-tooling/PhoneTracker.types';

const at = '2026-11-29T10:00:00.000Z';
const header = (id: string, armed: string) => ({
	id,
	title: 'Water the sample plant',
	project: 'personal',
	status: 'open',
	reminder: { at: armed, repeats: 'Weekly' }
});

function tools(shown: string) {
	const data: Record<string, unknown> = {
		tracker_status: {
			needsYou: [],
			recent: [],
			reminders: [header('plant-0002', '2026-11-30T10:00:00.000Z'), header('plant-0001', at)]
		},
		tracker_show: { item: header('plant-0001', shown), notes: [], runs: [] },
		tracker_done: { intentId: 'intent-1', status: 'queued' },
		tracker_remind: { intentId: 'intent-2', status: 'queued' }
	};
	const call = vi.fn<PhoneTrackerTools['call']>(async (name) => ({
		source: 'local_tracker',
		freshness: 'current',
		lastSyncedAt: null,
		partial: false,
		data: data[name]
	}));
	return { call, source: phoneTrackerInboxSource({ schemas: [], call, refresh: async () => {} }) };
}

describe('phone reminders', () => {
	it('lists the replica reminders soonest first and queues done and snooze', async () => {
		const { call, source } = tools(at);
		const listed = (await source.overview()).value!.reminders;
		expect(listed.map((entry) => entry.id)).toEqual(['plant-0001', 'plant-0002']);
		await source.write(reminderWrite(listed[0]));
		const until = '2026-11-30T09:00:00.000Z';
		await source.write(reminderWrite(listed[0], until));
		expect(call.mock.calls.filter(([name]) => name !== 'tracker_show').slice(1)).toEqual([
			['tracker_done', { id: 'plant-0001', text: '' }],
			['tracker_remind', { id: 'plant-0001', text: until }]
		]);
	});

	it('queues nothing for a reminder that moved since it was listed', async () => {
		const { call, source } = tools('2026-12-06T10:00:00.000Z');
		const reply = await source.write(reminderWrite(header('plant-0001', at) as never));
		expect(reply).toMatchObject({ code: 'staleReview' });
		expect(call.mock.calls.map(([name]) => name)).toEqual(['tracker_show']);
	});
});
