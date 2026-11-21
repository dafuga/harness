// @harness-uid u_7763mfxmkn
import type { TrackerPersistenceService } from './TrackerPersistenceService';
import type { TrackerSpokeOptions, TrackerSpokeRequest } from './TrackerSpokeSyncService.types';

export interface TrackerSpokeLoopOptions extends Omit<TrackerSpokeOptions, 'store' | 'transport'> {
	store: TrackerSpokeOptions['store'] & Pick<TrackerPersistenceService, 'subscribe'>;
	transport(request: TrackerSpokeRequest, signal: AbortSignal): Promise<unknown>;
	pushIntervalMs?: number;
	onError?(direction: 'push' | 'pull', error: unknown): void;
	onDuePolicy?(policy: unknown): void;
}
