// @harness-uid u_g7kdpz7bel
import type { TrackerBlockerInbox } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';

export interface TrackerBlockerSyncResult {
	escalated: string[];
	rechecked: string[];
	blockers: TrackerBlockerInbox;
}
