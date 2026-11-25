// @harness-uid u_xba7ieg4je
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import type { TrackerBlocker, TrackerItemRow } from '../TrackerItemReadRepository.types';
import { trackerBlockerEntries } from './buildTrackerBlockers';

const blockerRows = `SELECT items.*, tracker_item_chases.*,
	coalesce(latest_note.text, items.notes) AS blocker_note, latest_note.hlc AS blocker_note_clock
	FROM items LEFT JOIN tracker_item_chases ON chase_item_id = id
	LEFT JOIN item_notes AS latest_note ON latest_note.item_id = id AND latest_note.hlc = (
		SELECT hlc FROM item_notes WHERE item_id = id AND text NOT LIKE 'watchdog %'
		ORDER BY hlc DESC LIMIT 1
	) AND status = 'in_progress' AND needs_daniel = 0
	WHERE deleted = 0 AND title IS NOT NULL AND status NOT IN ('done', 'ignored') AND
	(parked_until IS NULL OR parked_until <= ?1) AND
	(status = 'blocked' OR (needs_daniel = 1 AND resolved = 0 AND (remind_at IS NULL OR remind_at <= ?1))
	OR (status = 'in_progress' AND needs_daniel = 0))`;

const blockerNote =
	/^\s*(?:blocked(?:[!:—–-]|\s+(?:on|by|until|because|waiting)\b|\s*$)|(?:(?:this (?:task|item)|work|implementation|verification|release)\s+)?awaits\b|missing\s+(?:(?:a|the)\s+)?credentials?\b)/im;

/** Read explicit blockers, open asks and unflagged in-progress items with a current blocker note. */
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
	const blockers = rows.filter(
		(row) =>
			row.status === 'blocked' || row.needs_daniel || blockerNote.test(row.blocker_note ?? '')
	);
	return trackerBlockerEntries(blockers, nowMs, statuses);
}
