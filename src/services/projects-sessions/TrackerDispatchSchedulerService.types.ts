// @harness-uid u_4rnjtzp6cn
import type {
	TrackerDispatchEvent,
	TrackerDispatchPolicy,
	TrackerDispatchResult,
	TrackerDueGrant,
	TrackerRunReceipt
} from '../agents-providers/TrackerDispatcherService.types';

export type TrackerReservedStart = Extract<TrackerDispatchResult, { status: 'start' }>;

export interface TrackerDispatchRunner {
	/** Launch only the committed attempt key. Throw when execution is uncertain. */
	start(
		reservation: TrackerReservedStart,
		signal: AbortSignal
	): Promise<TrackerDispatchEvent | undefined>;
	/** Match runner evidence using the exact attempt key. Missing evidence keeps a reservation pending. */
	observe(
		run: TrackerRunReceipt,
		key: string,
		signal: AbortSignal
	): Promise<TrackerDispatchEvent | undefined>;
}

export interface TrackerDispatchSchedulerOptions {
	runner: TrackerDispatchRunner;
	policy?: TrackerDispatchPolicy;
	scheduleDue?: boolean;
	grant?(itemId: string, token: string, signal: AbortSignal): Promise<TrackerDueGrant>;
}
