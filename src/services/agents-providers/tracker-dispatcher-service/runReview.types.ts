// @harness-uid u_rzpjc6wqqy
import type { TrackerDispatchPolicy } from '../TrackerDispatcherService.types';

export interface Clock {
	policy: TrackerDispatchPolicy;
	now: number;
}
