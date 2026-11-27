// @harness-uid u_tbi2v5xdgj
import type { TrackerBundleHost } from '../src/services/development-tooling/tracker-bundle/TrackerBundleService.types';

export interface FakeLaunchd {
	host: TrackerBundleHost;
	calls: string[];
	loaded: boolean;
	/** Simulated time between bootout and exit of the old process. */
	stopDelayMs: number;
	/** Whether `tracker ensure` succeeds for the executable the service runs. */
	ready: (executable: string) => boolean;
}

export interface FakeJob {
	elapsed: number;
	labelRemovedAt: number;
	processExitsAt: number;
	pid: number;
}
