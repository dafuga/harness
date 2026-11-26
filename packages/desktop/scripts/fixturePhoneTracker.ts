// @harness-uid u_rp545ji5cr
import { DatabaseSync } from 'node:sqlite';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';

/** The fixture uses the native hub projection in memory. No real Tracker process is contacted. */
export function fixturePhoneTracker() {
	const db = new DatabaseSync(':memory:');
	const writeGrant = { device: '', token: 'synthetic-mobile-fixture-write-token' };
	const { store, items } = new TrackerNativeRuntimeService(db, {
		role: 'hub',
		node: 'fixture',
		storage: { databaseId: () => 'fixture-mobile-tracker' },
		phoneWrite: writeGrant
	});
	const id = 'testphone1';
	store.appendLocal({
		itemId: id,
		actor: 'Fixture',
		fields: {
			title: 'Tracker on the phone',
			status: 'in_progress',
			agent: 'fixture',
			needs_daniel: true,
			question: 'Read on the simulator?',
			options: JSON.stringify([
				{ label: 'Yes', effect: 'The note was readable.', recommended: true },
				{ label: 'No', effect: 'Something was missing.' }
			]),
			'note+': 'This note was synced from the isolated hub.'
		}
	});
	return {
		fetcher: (input: RequestInfo | URL, init?: RequestInit) =>
			items.handle(new Request(input, init)),
		approveWrites: (device: string) => {
			writeGrant.device = device;
			return writeGrant;
		},
		finish: () => store.appendLocal({ itemId: id, fields: { status: 'done', resolved: true } }),
		close: () => db.close()
	};
}
