// @harness-uid u_cnfb5ax3bj
import type { TrackerResourceSample } from '../../utils/projects-sessions/trackerMachine.types';

export interface TrackerMachineSampler {
	sample(now: number): Promise<TrackerResourceSample>;
}

export interface TrackerMachineServiceOptions {
	now: () => number;
	/** Absent when this node does not report its own resources. */
	sampler?: TrackerMachineSampler;
}

/** A fleet report as received. Only a named node with a valid resource sample is used. */
export type TrackerFleetReport = object | string | number | boolean | null;
