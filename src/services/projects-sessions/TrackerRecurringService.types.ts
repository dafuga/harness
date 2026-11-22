// @harness-uid u_adwgoryfne
import type {
	TrackerRecurringJob,
	TrackerRecurringWake
} from '../../repositories/projects-sessions/TrackerRecurringRepository.types';

export interface TrackerRecurringJobRequest extends TrackerRecurringJob {
	key: string;
	occurrence: string;
}

export interface TrackerRecurringJobReceipt {
	code: number;
	timedOut: boolean;
	output: string;
}

export interface TrackerRecurringJobRunner {
	/** Start a configured job after its identity has been durably claimed. */
	start(
		request: TrackerRecurringJobRequest,
		signal: AbortSignal
	): Promise<TrackerRecurringJobReceipt>;
	/** Return the existing receipt for this exact identity, without starting a process. */
	observe(
		request: TrackerRecurringJobRequest,
		signal: AbortSignal
	): Promise<TrackerRecurringJobReceipt | undefined>;
}

export interface TrackerRecurringOptions {
	now: () => number;
	/** Synchronously persist the wake by its stable key, or throw when persistence fails. */
	enqueue: (wake: TrackerRecurringWake) => void;
	jobs?: TrackerRecurringJobRunner;
}
