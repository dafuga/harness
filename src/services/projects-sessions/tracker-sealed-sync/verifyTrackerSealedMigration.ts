// @harness-uid u_3yhwkjpypp
import { TrackerSnapshotAdapter } from '../../../adapters/projects-sessions/TrackerSnapshotAdapter';
import type { TrackerSnapshotSyncOptions } from '../../../adapters/projects-sessions/TrackerSnapshotAdapter.types';

const sealedStateTables = new Set([
	'sealed_tracker_outbox',
	'sealed_tracker_cursor',
	'sealed_tracker_scan'
]);

/** Compare one host's quiesced backup before and after enabling the sealed log. */
export function verifyTrackerSealedMigration(
	beforePath: string,
	afterPath: string,
	sync: TrackerSnapshotSyncOptions
) {
	const comparison = new TrackerSnapshotAdapter().compare(beforePath, afterPath, sync);
	const changedTables = comparison.changedTables.filter((name) => !sealedStateTables.has(name));
	const afterTables = new Set(comparison.after.tables.map(({ name }) => name));
	return {
		...comparison,
		matches:
			changedTables.length === 0 &&
			comparison.changedPendingLinks.length === 0 &&
			[...sealedStateTables].every((name) => afterTables.has(name)),
		changedTables
	};
}
