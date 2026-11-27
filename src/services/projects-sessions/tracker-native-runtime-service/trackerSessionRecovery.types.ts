// @harness-uid u_bl6xl2h4a3
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerLadderConfig } from '../../../utils/agents-providers/parseTrackerModelSpec.types';
import type { TrackerWatchdogLaunch } from './trackerSessionHealth.types';

export interface TrackerRecoveryInput {
	item: TrackerItem;
	launch: TrackerWatchdogLaunch;
	now: number;
	ladderConfig?: TrackerLadderConfig;
}

export interface TrackerRecoveryState {
	token: string | null;
	requestedAt: number;
	lastToken?: string | null;
	retryAt: number;
	failures: string[];
}
