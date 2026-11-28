import { DatabaseSync } from 'node:sqlite';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { expect } from '../verificationExpect';
import { primary } from './trackerDispatcherFixture';

export const allIgnored = {
	dated: 'ignored',
	timed: 'ignored',
	forever: 'ignored',
	later: 'ignored'
};

/** A node holding one ignore per kind of end: a date, a time, none and a far date. */
export async function ignoringNode(role: 'hub' | 'spoke', clock: () => number) {
	const database = new DatabaseSync(':memory:');
	const runtime = new TrackerNativeRuntimeService(database, { node: primary, role, now: clock });
	const ignores = {
		dated: '2026-07-02',
		timed: '2026-07-02T10:30:00+01:00',
		forever: undefined,
		later: '2099-01-01'
	};
	for (const [itemId, until] of Object.entries(ignores)) {
		const asked = itemId === 'dated';
		runtime.store.appendLocal({
			itemId,
			actor: 'Chief of Staff',
			fields: {
				title: `Ignore fixture ${itemId}`,
				status: asked ? 'in_progress' : 'open',
				needs_daniel: asked ? 1 : 0
			}
		});
		const response = await runtime.items.handle(
			new Request(`http://tracker.test/items/${itemId}/ignore`, {
				method: 'POST',
				body: JSON.stringify({ reason: 'later', by: 'operator', until })
			})
		);
		expect(response.status).toBe(200);
	}
	const row = (id: string) =>
		database.prepare('SELECT status, ignored_until, needs_daniel FROM items WHERE id = ?').get(id);
	return {
		database,
		runtime,
		row,
		statuses: () =>
			Object.fromEntries(Object.keys(ignores).map((id) => [id, row(id)?.status as string])),
		lastNote: (id: string) =>
			database
				.prepare('SELECT text FROM item_notes WHERE item_id = ? ORDER BY hlc DESC LIMIT 1')
				.get(id)?.text
	};
}
