import type {
	TrackerDeliveryRequest,
	TrackerDeliveryResult,
	TrackerNotificationOptions,
	TrackerNotificationQueue,
	TrackerNotificationState
} from '../../../../src/services/projects-sessions/TrackerNotificationService.types';

export interface FixtureQueue extends TrackerNotificationQueue {
	read(): TrackerNotificationState;
}

export interface FixtureOptions {
	options?: Partial<TrackerNotificationOptions>;
	queue?: FixtureQueue;
	send?: (request: TrackerDeliveryRequest) => Promise<TrackerDeliveryResult>;
}
