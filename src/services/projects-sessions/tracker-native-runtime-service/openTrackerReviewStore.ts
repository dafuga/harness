// @harness-uid u_bl6xl2h4a3
import { chiefReviewSinceKey } from '../../../repositories/projects-sessions/tracker-operation-repository/reviewTrackerOperation';
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import { migrateTrackerChiefReviews } from './migrateTrackerChiefReviews';

/** Open a node's journal with ask review on. Only the hub moves existing asks into the queue. */
export function openTrackerReviewStore(
	database: SqliteDatabase,
	{ node, role, storage }: TrackerNativeRuntimeOptions,
	now: () => number
): TrackerPersistenceService {
	const store = new TrackerPersistenceService(database, node, {
		...storage,
		now,
		chiefReview: role === 'hub' ? 'replicas' : 'local'
	});
	if (store.getMeta(chiefReviewSinceKey) === null)
		store.writeMeta({ [chiefReviewSinceKey]: String(now()) });
	if (role === 'hub') migrateTrackerChiefReviews(store);
	return store;
}
