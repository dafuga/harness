// @harness-uid u_7763mfxmkn
import type { TrackerPersistenceService } from './TrackerPersistenceService';
import type { TrackerSpokeOptions, TrackerSpokeRequest } from './TrackerSpokeSyncService.types';

export interface TrackerSpokeLoopOptions extends Omit<
	TrackerSpokeOptions,
	'store' | 'transport' | 'onPushAcknowledged'
> {
	store: TrackerSpokeOptions['store'] &
		Pick<TrackerPersistenceService, 'subscribe' | 'countOpsSince'>;
	transport(request: TrackerSpokeRequest, signal: AbortSignal): Promise<unknown>;
	pushIntervalMs?: number;
	endpoint?: URL;
	now?: () => number;
	onError?(direction: 'push' | 'pull', error: unknown): void;
	onDuePolicy?(policy: unknown): void;
}

export interface TrackerSpokeStatus {
	connected: boolean;
	lastPullOk: string | null;
	lastPushOk: string | null;
	lastError: string | null;
}
