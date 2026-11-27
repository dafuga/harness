import type { TrackerItemReadRepository } from '../../src/repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerPersistenceService } from '../../src/services/projects-sessions/TrackerPersistenceService';
import type { TrackerWatchdogAlert } from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostWatchdog.types';

export interface TrackerCliChannel {
	store: TrackerPersistenceService;
	items: TrackerItemReadRepository;
	/** What `tracker needs-attention` serves and the Chief of Staff tick delivers. */
	inbox(): readonly TrackerWatchdogAlert[];
	advance(milliseconds: number): void;
	offline(): void;
	run(...args: string[]): Promise<{ code: number; out: string }>;
}
