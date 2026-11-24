// @harness-uid u_g7kdpz7bel
import type { TrackerItemRow } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';

export interface TrackerInboxReview {
	item: TrackerItemRow;
	revision: string;
	flaggedAt: string | null;
}
