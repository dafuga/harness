// @harness-uid u_ksy76trvsj
import type { TrackerDispatchSnapshot } from '../../../services/agents-providers/TrackerDispatcherService.types';
import type { TrackerPersistenceService } from '../../../services/projects-sessions/TrackerPersistenceService';

export interface TrackerDispatchCommitTarget {
	store: TrackerPersistenceService;
	node: string;
	now?: () => number;
}

export interface TrackerDispatchCommitRequest {
	itemId: string;
	read: (itemId: string) => TrackerDispatchSnapshot;
}
