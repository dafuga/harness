// @harness-uid u_o3bwaj4ogu
import type {
	TrackerDestination,
	TrackerNotificationItem
} from '../../services/projects-sessions/TrackerNotificationService.types';

export interface TrackerNotificationSourceOptions {
	timeZone: string;
	resolveDestination(target: unknown): TrackerDestination | undefined;
}

export type TrackerStoredNotificationItem = Omit<TrackerNotificationItem, 'clocks' | 'callback'> & {
	clocks: string;
	callback: string | null;
};

export interface TrackerStoredNotificationAgent {
	name: string;
	target: string;
	created_at: number;
}
