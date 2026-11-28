import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import { trackerChiefReviewAlerts } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerChiefReviewQueue';

const noon = Date.UTC(2026, 10, 26, 12);
const choices = [
	{ label: 'First', effect: 'Use the default', recommended: true },
	{ label: 'Second', effect: 'Try another test' }
];
const released = {
	needs_daniel: 1,
	resolved: 0,
	question: 'Which fixture can we use?',
	options: JSON.stringify(choices)
};
const id = 'released01';

/** One ask that Chief of Staff has already published to Daniel. */
function releasedAsk() {
	const database = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(database, 'fixture-mac', {
		chiefReview: 'local',
		now: () => noon
	});
	const items = new TrackerItemReadRepository(database);
	store.appendLocal({
		itemId: id,
		actor: 'Chief of Staff',
		fields: { title: 'Synthetic ask', status: 'in_progress', ...released }
	});
	return { database, store, items };
}

test('a later blocker waiting on Daniel never withdraws a released ask', () => {
	const { database, store, items } = releasedAsk();
	try {
		store.appendLocal({
			itemId: id,
			actor: 'auto-worker-r1',
			fields: {
				status: 'blocked',
				blocked_reason: 'Waiting on Daniel for access',
				'note+': 'blocked: Waiting on Daniel for access'
			}
		});
		expect(items.getStored(id)).toMatchObject({
			needs_daniel: true,
			question: released.question,
			options: choices,
			blocked_reason: null,
			notes_log: []
		});
		expect(trackerChiefReviewAlerts(store)).toMatchObject([{ item_id: id, kind: 'chief-review' }]);
	} finally {
		database.close();
	}
});

test('restating a released flag without new wording does not send it back to review', () => {
	const { database, store, items } = releasedAsk();
	try {
		store.appendLocal({ itemId: id, fields: { status: 'ignored' } });
		store.appendLocal({ itemId: id, fields: { status: 'in_progress', needs_daniel: 1 } });
		expect(items.getStored(id)).toMatchObject({
			needs_daniel: true,
			question: released.question
		});
		expect(trackerChiefReviewAlerts(store)).toEqual([]);
	} finally {
		database.close();
	}
});

test('new wording from a session on a released ask is reviewed before Daniel sees it', () => {
	const { database, store, items } = releasedAsk();
	try {
		store.appendLocal({
			itemId: id,
			actor: 'auto-worker-r1',
			fields: { ...released, question: 'Can you also pick a second fixture?' }
		});
		expect(items.getStored(id)).toMatchObject({ needs_daniel: false, question: null });
		expect(items.digest(noon).daniel_decisions).toEqual([]);
		expect(trackerChiefReviewAlerts(store)).toHaveLength(1);
	} finally {
		database.close();
	}
});
