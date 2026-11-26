// @harness-uid u_bl6xl2h4a3
import type { TrackerDispatchSchedulerService } from '../TrackerDispatchSchedulerService';
import type { TrackerHubMachineStore } from '../TrackerHubSyncService.types';
import type { TrackerMachineService } from '../TrackerMachineService';

export type TrackerTelemetryParts = {
	machines: TrackerMachineService;
	/** Only a hub has a fleet store to record into. */
	fleet?: TrackerHubMachineStore;
	scheduler?: TrackerDispatchSchedulerService;
};
