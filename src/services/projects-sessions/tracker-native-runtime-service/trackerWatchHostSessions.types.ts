// @harness-uid u_bl6xl2h4a3
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerWatchdogLaunch } from './trackerSessionHealth.types';
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';

export interface WatchdogSessionHost {
	store: TrackerPersistenceService;
	items: TrackerItemReadRepository;
	driver: TrackerWatchdogPort;
}

export interface WatchdogSessionScan {
	readItems: () => readonly TrackerItem[];
	now: () => number;
	launch?: TrackerWatchdogLaunch;
	roots?: readonly string[];
}
