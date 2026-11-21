// @harness-uid u_bl6xl2h4a3
import type { z } from 'zod';
import type { TrackerHostRepository } from './nativeTrackerHostEffects.types';
import type { hostSession } from './trackerHostLaunchSchema';

export type TrackerHostSession = z.infer<typeof hostSession>;

export interface TrackerHostRouteItem {
	project?: string | null;
	agent?: string | null;
	repo?: string | null;
}

export type TrackerHostRoute = (item: TrackerHostRouteItem) => TrackerHostRepository | undefined;
