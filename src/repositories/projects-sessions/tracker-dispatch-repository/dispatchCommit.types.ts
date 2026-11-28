// @harness-uid u_ksy76trvsj
import type { TrackerDispatchSnapshot } from '../../../services/agents-providers/TrackerDispatcherService.types';
import type { TrackerPersistenceService } from '../../../services/projects-sessions/TrackerPersistenceService';
import type { TrackerDispatchRepositoryOptions } from '../TrackerDispatchRepository.types';

export interface TrackerDispatchCommitTarget extends Pick<
	TrackerDispatchRepositoryOptions,
	'now' | 'onStartupFailure'
> {
	store: TrackerPersistenceService;
	node: string;
}

export interface TrackerDispatchCommitRequest {
	itemId: string;
	read: (itemId: string) => TrackerDispatchSnapshot;
}
