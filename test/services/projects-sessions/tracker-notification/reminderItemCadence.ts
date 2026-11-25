import { expect } from '../../../verificationExpect';
import { wire, minute } from './fixture';
import type { notificationFixture } from './fixture';

export async function verifyReminderItemCadence(
	f: ReturnType<typeof notificationFixture>,
	wake: number
) {
	f.at(wake + 120 * minute);
	await f.restart().tick();
	expect(f.calls).toHaveLength(1);
	f.at(Date.parse('2026-02-03T08:00:00Z'));
	await f.restart().tick();
	expect(f.calls).toHaveLength(2);
	expect(f.calls[1].id).not.toEqual(f.calls[0].id);
	expect(wire(f.calls[1]).items).toMatchObject([{ item_id: 'wake', reminder_number: 1 }]);
	f.rows.set('wake', { ...f.rows.get('wake')!, status: 'done' });
	f.at(Date.parse('2026-02-04T08:00:00Z'));
	await f.restart().tick();
	expect(f.calls).toHaveLength(2);
}
