// @harness-uid u_5hr7siszzq
import type { TrackerLadderConfig } from '../../../utils/agents-providers/parseTrackerModelSpec.types';
import type { TrackerMachineService } from '../TrackerMachineService';

export type TrackerPlacedLaunch = { node: string; why: string };

export type TrackerFleetView = {
	machines: TrackerMachineService;
	ladderConfig?: TrackerLadderConfig;
	/** The latest fleet reports, with each launcher's routes and free slots. */
	samples(): readonly unknown[];
	now(): number;
};
