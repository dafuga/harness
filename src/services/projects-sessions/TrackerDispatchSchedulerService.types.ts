// @harness-uid u_4rnjtzp6cn
import type {
	TrackerDispatchEvent,
	TrackerDispatchPolicy,
	TrackerDispatchItem,
	TrackerLaunchIntent,
	TrackerDispatchResult,
	TrackerDueGrant,
	TrackerRunReceipt,
	TrackerSessionEvidence
} from '../agents-providers/TrackerDispatcherService.types';

export type TrackerReservedStart = Extract<TrackerDispatchResult, { status: 'start' }>;

export interface TrackerDispatchRunner {
	/** Refresh authoritative session evidence before reconciling or claiming work. */
	capacity?(): { freeSlots: number; projects: Record<string, { freePct: number; freeGB: number }> };
	stop?(run: TrackerRunReceipt, signal: AbortSignal): Promise<boolean>;
	refresh?(signal: AbortSignal, runs: readonly TrackerRunReceipt[]): Promise<void>;
	legacySession?(run: TrackerRunReceipt): TrackerSessionEvidence | undefined;
	confirmLegacyNeverStarted?(run: TrackerRunReceipt, signal: AbortSignal): Promise<boolean>;
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
	/** Tell an operator about a live run past its ETA or cap. Called on every tick it stays so. */
	overdue?(run: TrackerRunReceipt, reason: string): void;
	/** Confirm that the exact reservation has neither a host session nor any startup receipt. */
	confirmNeverStarted?(run: TrackerRunReceipt, signal: AbortSignal): Promise<boolean>;
}

export interface TrackerDispatchSchedulerOptions {
	runner: TrackerDispatchRunner;
	policy?: TrackerDispatchPolicy;
	scheduleDue?: boolean;
	alternateAdapterHost?(item: TrackerDispatchItem, intent: TrackerLaunchIntent): string | undefined;
	permitAutomatic?(itemId: string, token: string, signal: AbortSignal): Promise<boolean> | boolean;
	grant?(itemId: string, token: string, signal: AbortSignal): Promise<TrackerDueGrant>;
}
