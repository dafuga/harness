// @harness-uid u_dpbqtddngd
import type { TrackerItem } from '../../../../../../src/repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerListedRun } from '../../../../../../src/repositories/projects-sessions/TrackerRunReadRepository.types';

export interface TrackerInboxItemReply {
	item: TrackerItem;
	revision: string;
	flaggedAt: string | null;
	runs?: TrackerListedRun[];
}

export interface TrackerInboxReadInput {
	operation?: 'overview' | 'search' | 'detail' | 'document';
	id?: string;
	attachment?: string;
	query?: string;
}
