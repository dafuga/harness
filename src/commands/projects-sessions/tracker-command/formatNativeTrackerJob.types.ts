// @harness-uid u_nawtixuqir
import type {
	TrackerBoxJob,
	TrackerListedBoxJob
} from '../../../repositories/projects-sessions/TrackerRecurringRepository.types';

export interface NativeTrackerJobTest {
	exit_code: number;
	timed_out: boolean;
	finding: boolean;
	output: string;
}

export type NativeTrackerJobResponse =
	| TrackerListedBoxJob[]
	| TrackerBoxJob
	| { removed: string }
	| NativeTrackerJobTest;
