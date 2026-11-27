// @harness-uid u_7ndb7haya4
import type { TrackerNodeConfig } from '../tracker-node-service/trackerNodeConfig.types';

export interface TrackerHealthAlertTarget {
	config: TrackerNodeConfig;
	configPath: string;
	post: (url: string, init: RequestInit) => Promise<Response>;
	now: number;
}
