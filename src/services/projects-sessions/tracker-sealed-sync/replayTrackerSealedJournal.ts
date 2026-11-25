import type { TrackerOperationRepository } from '../../../repositories/projects-sessions/TrackerOperationRepository';
import type { TrackerOperation } from '../../../repositories/projects-sessions/TrackerOperationRepository.types';
import type { TrackerSealedSyncService } from './TrackerSealedSyncService';

/**
 * Stage one bounded page from a single journal. Use a stable device/scope outbox namespace
 * for that journal. A retry from the same cursor retains the original encrypted retry IDs.
 * The caller supplies the scope admission rule and persists the returned scan cursor.
 */
export async function replayTrackerSealedJournal(
	journal: Pick<TrackerOperationRepository, 'opsSince'>,
	sync: Pick<TrackerSealedSyncService, 'stage' | 'push'>,
	after: number,
	belongsToScope: (operation: TrackerOperation) => boolean
): Promise<number> {
	const page = journal.opsSince(after, 64);
	for (const { seq, ...operation } of page) {
		if (belongsToScope(operation)) await sync.stage(seq, operation);
	}
	while ((await sync.push()) > 0) {
		// Each receipt removes its batch from the pending outbox.
	}
	return page.at(-1)?.seq ?? after;
}
