// @harness-uid u_adwgoryfne
import type {
	TrackerRecurringJob,
	TrackerRecurringWake
} from '../../repositories/projects-sessions/TrackerRecurringRepository.types';

export interface TrackerRecurringJobRequest extends TrackerRecurringJob {
	cmd: string;
	key: string;
	occurrence: string;
}

export interface TrackerRecurringJobReceipt {
	code: number;
	timedOut: boolean;
	output: string;
}

export interface TrackerRecurringJobRunner {
	/** True while no further job may start. Claimable work stays queued. */
	busy?(): boolean;
	/** Start a claimed job. Resolve without a receipt while it is still running. */
	start(
		request: TrackerRecurringJobRequest,
		signal: AbortSignal
	): Promise<TrackerRecurringJobReceipt | undefined>;
	/** Return the existing receipt for this exact identity, without starting a process. */
	observe(
		request: TrackerRecurringJobRequest,
		signal: AbortSignal
	): Promise<TrackerRecurringJobReceipt | undefined>;
	/** Wait until every started job has stored its receipt. */
	drain?(): Promise<void>;
}

/** A runner that can also serve the `tracker job` commands. */
export interface TrackerBoxJobRunner extends TrackerRecurringJobRunner {
	running(itemId: string): boolean;
	/** Run a job now. Nothing is stored. */
	test(
		request: Omit<TrackerRecurringJobRequest, 'key'>,
		signal: AbortSignal
	): Promise<TrackerRecurringJobReceipt>;
}

export interface TrackerRecurringOptions {
	now: () => number;
	/** Synchronously persist the wake by its stable key, or throw when persistence fails. */
	enqueue: (wake: TrackerRecurringWake) => void;
	jobs?: TrackerRecurringJobRunner;
}
