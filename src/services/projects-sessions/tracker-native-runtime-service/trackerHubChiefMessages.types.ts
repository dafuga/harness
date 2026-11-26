// @harness-uid u_bl6xl2h4a3
import type { TrackerChiefChannel } from '../TrackerNotificationService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';

export interface HubChiefDelivery {
	store: TrackerPersistenceService;
	/** The hub's Chief of Staff channel; undefined when none is configured. */
	channel: () => TrackerChiefChannel | undefined;
	now?: () => number;
}
