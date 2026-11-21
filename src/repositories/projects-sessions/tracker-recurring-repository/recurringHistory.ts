// @harness-uid u_7ryrqak22k
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import type { TrackerRecurringResult } from '../TrackerRecurringRepository.types';

/** The Recurrer and JobRunner tables in Tracker 4a6be709. */
export const trackerRecurringSchema = `
CREATE TABLE IF NOT EXISTS recurring_state(item_id TEXT PRIMARY KEY, spec TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS occurrences(
  item_id TEXT NOT NULL, occurrence TEXT NOT NULL, status TEXT NOT NULL,
  fired_at INTEGER, result_at TEXT, note TEXT, by TEXT,
  PRIMARY KEY(item_id, occurrence)
);
CREATE TABLE IF NOT EXISTS box_jobs(
  item_id TEXT PRIMARY KEY, cmd TEXT NOT NULL, wake_on TEXT NOT NULL DEFAULT 'finding',
  timeout_s INTEGER NOT NULL DEFAULT 120, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);`;

export function readRecurringResult(value: string | null): TrackerRecurringResult | null {
	if (!value) return null;
	try {
		const result = JSON.parse(value) as TrackerRecurringResult | null;
		return result?.occurrence && (result.status === 'done' || result.status === 'failed')
			? result
			: null;
	} catch {
		return null;
	}
}

export function syncRecurringResult(
	db: SqliteDatabase,
	id: string,
	result: TrackerRecurringResult
) {
	const { occurrence, status, at, note, by } = result;
	db.prepare(
		`INSERT INTO occurrences (item_id, occurrence, status, result_at, note, by)
		VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(item_id, occurrence) DO UPDATE SET
		status = excluded.status, result_at = excluded.result_at, note = excluded.note, by = excluded.by
		WHERE occurrences.result_at IS NOT excluded.result_at`
	).run(id, occurrence, status, at ?? null, note ?? null, by ?? null);
}

export function writeOccurrence(
	db: SqliteDatabase,
	id: string,
	occurrence: string,
	at: number | null
) {
	db.prepare(
		`INSERT INTO occurrences (item_id, occurrence, status, fired_at)
		VALUES (?, ?, ?, ?) ON CONFLICT(item_id, occurrence) DO UPDATE SET
		status = excluded.status WHERE occurrences.status = 'pending'`
	).run(id, occurrence, at === null ? 'missed' : 'pending', at);
}
