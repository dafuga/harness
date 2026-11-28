// @harness-uid u_c5mwmd6z6z
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import { trackerClockMilliseconds } from '../../../utils/projects-sessions/nextTrackerClock';
import type { TrackerOperation } from '../TrackerOperationRepository.types';
import { chiefReviewFields } from './chiefReviewFields';
import type { CurrentChiefReview } from './chiefReviewFields.types';
import type { TrackerReviewGate } from './reviewTrackerOperation.types';

export const chiefReviewSinceKey = 'chief_review_since';

export function reviewLocalOperation(
	database: SqliteDatabase,
	gate: TrackerReviewGate,
	operation: TrackerOperation
): TrackerOperation {
	if (gate === 'off' || !operation?.fields) return operation;
	const current = database
		.prepare('SELECT chief_review, chief_answer, needs_daniel, resolved FROM items WHERE id = ?')
		.get(operation.item_id) as CurrentChiefReview | undefined;
	return { ...operation, fields: chiefReviewFields(operation, { current }) };
}

/**
 * The hub also reviews asks sent by a computer that does not review yet. History written before
 * review started is replayed as it was, so a resolved ask is never held again.
 */
export function reviewReplicatedOperation(
	database: SqliteDatabase,
	gate: TrackerReviewGate,
	operation: TrackerOperation
): TrackerOperation {
	if (gate !== 'replicas' || typeof operation?.hlc !== 'string') return operation;
	const row = database.prepare('SELECT v FROM meta WHERE k = ?').get(chiefReviewSinceKey) as
		| { v: string }
		| undefined;
	if (!row || trackerClockMilliseconds(operation.hlc) < Number(row.v)) return operation;
	return reviewLocalOperation(database, gate, operation);
}
