// @harness-uid u_46eur7qage
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import { assertLegacyRecurringRollbackSafe } from '../../../repositories/projects-sessions/TrackerRecurringRepository';
import { assertLegacyDispatchRollbackSafe } from '../../../repositories/projects-sessions/TrackerDispatchRepository';

/** Inspect the stopped database without initializing any legacy or native worker schema. */
export function assertTrackerLegacyRollbackSafe(database: SqliteDatabase): void {
	const table = database.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?");
	if (table.get('runs')) assertLegacyDispatchRollbackSafe(database);
	assertLegacyRecurringRollbackSafe(database);
	if (
		table.get('harness_notification_inflight') &&
		database.prepare('SELECT 1 FROM harness_notification_inflight LIMIT 1').get()
	) {
		throw new DOMException(
			'Tracker rollback blocked by an unacknowledged notification',
			'InvalidStateError'
		);
	}
}
