// @harness-uid u_c5mwmd6z6z
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import { readChiefReview } from './chiefReviewFields';

/** The held question, for launch rules only. It is never copied onto the item. */
export function readPendingTrackerQuestion(database: SqliteDatabase, id: string): string | null {
	const row = database.prepare('SELECT chief_review FROM items WHERE id = ?').get(id) as
		| { chief_review: string | null }
		| undefined;
	const fields = readChiefReview(row?.chief_review)?.fields;
	const question = fields?.question ?? fields?.blocked_reason;
	return typeof question === 'string' ? question : null;
}
