// @harness-uid u_e7x5dhawh4
import type { TrackerNotificationSourceOptions } from './TrackerNotificationSourceRepository.types';

export interface TrackerNotificationQueueOptions {
	resolveDestination: TrackerNotificationSourceOptions['resolveDestination'];
	now?: () => number;
}
