import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import {
	migrateTrackerChiefReviews,
	publishApprovedReviews,
	trackerChiefReviewAlerts
} from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerChiefReviewQueue';
import {
	recordCosReceipts,
	unsentCosAlerts
} from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostCos';

const noon = Date.UTC(2026, 10, 26, 12);
const choices = [
	{ label: 'First', effect: 'Use the default', recommended: true },
	{ label: 'Second', effect: 'Try another test' }
];
const decision = {
	question: 'Which fixture can we use?',
	needs_daniel: 1,
	resolved: 0,
	options: JSON.stringify(choices)
};

test('migrates legacy flags, plumbing and blockers and preserves the receipt across replicas', () => {
	using database = new DatabaseSync(':memory:');
	const old = new TrackerPersistenceService(database, 'old-mac', { now: () => noon });
	old.appendLocal({
		itemId: 'decision01',
		fields: { title: 'Fixture decision', status: 'open', ...decision }
	});
	old.appendLocal({
		itemId: 'blocker001',
		fields: {
			title: 'Fixture blocker',
			status: 'blocked',
			blocked_reason: 'Waiting on Daniel for access',
			'note+': 'blocked: Waiting on Daniel for access'
		}
	});
	old.appendLocal({
		itemId: 'plumbing01',
		fields: {
			title: 'Tracker alerts are not reaching Chief of Staff',
			status: 'open',
			...decision,
			question: '5 Tracker alerts have not reached your Chief of Staff session.'
		}
	});
	const current = new TrackerPersistenceService(database, 'new-mac', {
		chiefReview: true,
		now: () => noon
	});
	migrateTrackerChiefReviews(current);
	const items = new TrackerItemReadRepository(database);
	expect(items.digest(noon).to_unblock).toEqual([]);
	expect(items.getStored('blocker001').notes_log).toEqual([]);
	expect(
		trackerChiefReviewAlerts(current)
			.map(({ kind }) => kind)
			.sort()
	).toEqual(['chief-only-review', 'chief-review', 'chief-review']);
	const amount = current.maxSeq();
	migrateTrackerChiefReviews(current);
	expect(current.maxSeq()).toBe(amount);
	recordCosReceipts(current, trackerChiefReviewAlerts(current));
	expect(unsentCosAlerts(current, trackerChiefReviewAlerts(current))).toEqual([]);

	using otherDatabase = new DatabaseSync(':memory:');
	const other = new TrackerPersistenceService(otherDatabase, 'other-mac', {
		chiefReview: true,
		now: () => noon
	});
	other.applyOps(current.opsSince(0, 100));
	const otherItems = new TrackerItemReadRepository(otherDatabase);
	expect(otherItems.digest(noon).to_unblock).toEqual([]);
	expect(unsentCosAlerts(current, trackerChiefReviewAlerts(other))).toEqual([]);
});

test('holds requests from Daniel and Chief of Staff overnight, then publishes once', () => {
	using database = new DatabaseSync(':memory:');
	const night = noon - 6 * 60 * 60_000;
	let now = night;
	const store = new TrackerPersistenceService(database, 'fixture-mac', {
		chiefReview: true,
		now: () => now
	});
	const items = new TrackerItemReadRepository(database);
	for (const [id, actor] of [
		['chief00001', 'Chief of Staff'],
		['daniel0001', 'Daniel']
	])
		store.appendLocal({ itemId: id, actor, fields: { title: id, status: 'open', ...decision } });
	expect(items.digest(now).daniel_decisions).toEqual([]);
	expect(trackerChiefReviewAlerts(store)).toEqual([]);
	publishApprovedReviews(store, now);
	expect(items.digest(now).daniel_decisions).toEqual([]);
	now = noon - 4 * 60 * 60_000;
	publishApprovedReviews(store, now);
	expect(items.digest(now).daniel_decisions).toMatchObject([
		{ question: decision.question, options: choices },
		{ question: decision.question, options: choices }
	]);
	const count = store.maxSeq();
	publishApprovedReviews(store, now + 60_000);
	expect(store.maxSeq()).toBe(count);
});
