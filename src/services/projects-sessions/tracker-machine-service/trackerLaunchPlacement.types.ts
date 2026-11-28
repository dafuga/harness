// @harness-uid u_5hr7siszzq
import type { TrackerWorkDemand } from '../../../utils/projects-sessions/trackerMachine.types';
import type { TrackerMachineService } from '../TrackerMachineService';

export type TrackerPlacementReservation = TrackerWorkDemand & { sessions: number };

export type TrackerPlacedLaunch = { node: string; why: string; demand: TrackerWorkDemand };

export type TrackerFleetView = {
	machines: TrackerMachineService;
	/** The latest fleet reports, with each launcher's routes and free slots. */
	samples(): readonly unknown[];
	now(): number;
};
