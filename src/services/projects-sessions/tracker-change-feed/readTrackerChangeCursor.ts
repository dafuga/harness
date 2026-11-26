// @harness-uid u_dul2zizb3o
import { createHash } from 'node:crypto';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';

/** Only what a screen shows. Token counts and watchdog bookkeeping do not wake clients. */
const runColumns = 'id, state, outcome, session_name, started_at, ended_at, eta_at';

const runQueries = [
	`SELECT ${runColumns} FROM runs ORDER BY id DESC LIMIT 200`,
	`SELECT node, id, state, outcome, session_name, started_at, ended_at FROM remote_runs
		ORDER BY coalesce(ended_at, started_at, queued_at) DESC, node, id DESC LIMIT 200`
];

/**
 * Where the tracker stands now: the journal head, which covers items, notes, flags and answers,
 * and a digest of the recent runs, which are not journaled. It is derived from stored state, so
 * a client that was away compares its last cursor and cannot miss a change.
 */
export function readTrackerChangeCursor(store: TrackerPersistenceService): string {
	const hash = createHash('sha256');
	for (const sql of runQueries) hash.update(JSON.stringify(rows(store, sql)));
	return `${store.dbId}.${store.maxSeq()}.${hash.digest('hex').slice(0, 16)}`;
}

/** A store without run tables (a fresh or item-only database) has no runs to report. */
function rows(store: TrackerPersistenceService, sql: string): unknown[] {
	try {
		return store.database.prepare(sql).all();
	} catch {
		return [];
	}
}
