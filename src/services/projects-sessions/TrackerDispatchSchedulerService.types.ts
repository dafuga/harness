// @harness-uid u_4rnjtzp6cn
import type {
	TrackerDispatchEvent,
	TrackerDispatchPolicy,
	TrackerDispatchResult,
	TrackerDueGrant,
	TrackerRunReceipt,
	TrackerSessionEvidence
} from '../agents-providers/TrackerDispatcherService.types';

export type TrackerReservedStart = Extract<TrackerDispatchResult, { status: 'start' }>;

export interface TrackerDispatchRunner {
	/** Refresh authoritative session evidence before reconciling or claiming work. */
	refresh?(signal: AbortSignal, runs: readonly TrackerRunReceipt[]): Promise<void>;
	legacySession?(run: TrackerRunReceipt): TrackerSessionEvidence | undefined;
	/** Append the completion instructions to the launch brief and launch only the committed attempt key. */
	start(
		reservation: TrackerReservedStart,
		signal: AbortSignal,
		completionInstructions: string
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
