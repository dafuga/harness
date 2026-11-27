// @harness-uid u_ksy76trvsj
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';

const activeStates = "('queued','running','verifying')";

/**
 * Failed attempts of finished items that no attempt can still claim: nothing is active, and no
 * computer ran a successful attempt after them.
 */
export function humanRedoCandidates(database: SqliteDatabase) {
	const rows = database
		.prepare(
			`SELECT r.item_id AS itemId, r.id FROM runs r
		JOIN meta m ON m.k = 'harness_dispatch_run:' || r.id
		JOIN items i ON i.id = r.item_id
		WHERE r.outcome IN ('failed','rejected','timed_out') AND r.redone_by IS NULL
		AND i.status = 'done' AND i.deleted = 0
		AND NOT EXISTS (SELECT 1 FROM runs a WHERE a.item_id = r.item_id AND a.state IN ${activeStates})
		AND NOT EXISTS (
			SELECT 1 FROM remote_runs a WHERE a.item_id = r.item_id AND a.state IN ${activeStates})
		AND NOT EXISTS (
			SELECT 1 FROM runs d WHERE d.item_id = r.item_id AND d.outcome = 'done'
			AND d.queued_at >= r.queued_at)
		AND NOT EXISTS (
			SELECT 1 FROM remote_runs d WHERE d.item_id = r.item_id AND d.outcome = 'done'
			AND d.queued_at >= r.queued_at)
		ORDER BY r.item_id, r.id`
		)
		.all() as { itemId: string; id: number }[];
	const items = new Map<string, number[]>();
	for (const { itemId, id } of rows) items.set(itemId, [...(items.get(itemId) ?? []), id]);
	return items;
}
