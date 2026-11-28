// @harness-uid u_54duc53h47
import { completeCosSafetyNotice, readCosSafetyNotice } from './trackerCosDelivery';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { openPushAsks } from '../tracker-web-push-service/openPushAsks';
import { TrackerWebPushService } from '../TrackerWebPushService';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';

/** Only the Tracker hub notifies Daniel's browsers, so one decision is announced once. */
export function composeTrackerWebPush(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions
): TrackerWebPushService | undefined {
	const { role, webPush, now = Date.now } = options;
	if (role !== 'hub' || !webPush) return undefined;
	const items = new TrackerItemReadRepository(store.database);
	return new TrackerWebPushService({
		...webPush,
		now,
		safety: {
			read: () => readCosSafetyNotice(store),
			complete: (generation) => completeCosSafetyNotice(store, generation)
		},
		asks: () => openPushAsks(items.list({ flagged: true, limit: 1000 }, now()))
	});
}
