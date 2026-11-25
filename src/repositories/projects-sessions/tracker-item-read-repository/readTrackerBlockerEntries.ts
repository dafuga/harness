// @harness-uid u_xba7ieg4je
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import type { TrackerBlocker, TrackerItemRow } from '../TrackerItemReadRepository.types';
import { trackerBlockerEntries } from './buildTrackerBlockers';

const blockerRows = `SELECT * FROM items LEFT JOIN tracker_item_chases ON chase_item_id = id
	WHERE deleted = 0 AND title IS NOT NULL AND status NOT IN ('done', 'ignored') AND
	(parked_until IS NULL OR parked_until <= ?1) AND
	(status = 'blocked' OR (needs_daniel = 1 AND resolved = 0 AND (remind_at IS NULL OR remind_at <= ?1)))`;

/** Read every blocked item and open Daniel ask, with the status of any item it waits on. */
export function readTrackerBlockerEntries(
	database: SqliteDatabase,
	nowMs: number
): TrackerBlocker[] {
	const rows = database.prepare(blockerRows).all(new Date(nowMs).toISOString()) as TrackerItemRow[];
	const statuses = new Map(
		(
			database
				.prepare('SELECT id, status FROM items WHERE deleted = 0 AND title IS NOT NULL')
				.all() as {
				id: string;
				status: string;
			}[]
		).map(({ id, status }) => [id.slice(0, 6), status])
	);
	return trackerBlockerEntries(rows, nowMs, statuses);
}
