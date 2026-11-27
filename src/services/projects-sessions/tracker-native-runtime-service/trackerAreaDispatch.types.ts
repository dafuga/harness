// @harness-uid u_bl6xl2h4a3
import type { TrackerDispatchItem } from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerReservedStart } from '../TrackerDispatchSchedulerService.types';
export type AreaPermit = (
	item: TrackerDispatchItem,
	start: Pick<TrackerReservedStart, 'key' | 'run'>
) => Promise<{ allowed: boolean; reason: string }>;
