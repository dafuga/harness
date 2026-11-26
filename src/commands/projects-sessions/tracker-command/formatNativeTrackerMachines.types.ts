// @harness-uid u_2njoexd2vc
import type {
	TrackerMachineRow,
	TrackerResourceSample
} from '../../../utils/projects-sessions/trackerMachine.types';

export type Summary = Omit<TrackerMachineRow, 'sample'> & Partial<TrackerResourceSample>;

export type Detail = Summary & {
	sample: TrackerResourceSample | null;
	history: TrackerResourceSample[];
};

export type NativeTrackerMachines = Summary[] | Detail;
