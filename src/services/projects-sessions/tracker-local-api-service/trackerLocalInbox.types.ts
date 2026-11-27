// @harness-uid u_g7kdpz7bel
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerListedRun } from '../../../repositories/projects-sessions/TrackerRunReadRepository.types';
import type { TrackerLocalApiOptions } from '../TrackerLocalApiService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type {
	TrackerItem,
	TrackerItemRow
} from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';

export interface TrackerInboxReview {
	item: TrackerItemRow;
	revision: string;
	flaggedAt: string | null;
}

export interface TrackerInboxRoute {
	store: TrackerPersistenceService;
	items: TrackerItemReadRepository;
	options: TrackerLocalApiOptions;
	actor: string | null;
}

export type TrackerInboxResult =
	| { status: 'accepted' }
	| { item: TrackerItem; revision: string; flaggedAt: string | null; runs: TrackerListedRun[] };
