// @harness-uid u_h5qlvks3hh
import type { TrackerItemSnapshot } from './planTrackerItemMutation.types';

export type TrackerIgnoredItem = TrackerItemSnapshot & {
	readonly ignored_until?: string | null;
};
