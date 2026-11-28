// @harness-uid u_rzpjc6wqqy
import type { TaskSelection } from '../../repositories/agents-providers/ModuleTaskRepository.types';

import type { TrackerRunReceipt } from './tracker-dispatcher-service/runReceipt.types';
export type {
	TrackerDispatchEvent,
	TrackerReceiptUsage,
	TrackerRunReceipt,
	TrackerSessionEvidence
} from './tracker-dispatcher-service/runReceipt.types';

export type TrackerLaunchSource = 'manual' | 'automatic' | 'due' | 'recovery';
export type TrackerItemStatus = 'open' | 'in_progress' | 'blocked' | 'done' | 'ignored';
export type TrackerDispatchOutcome =
	| 'done'
	| 'failed'
	| 'rejected'
	| 'blocked'
	| 'timed_out'
	| 'abandoned';

export interface TrackerLaunchOptions {
	computer?: string | null;
	project?: string | null;
	repo?: string | null;
	model?: string | null;
	sensitive?: boolean;
}

export interface TrackerDispatchItemModel {
	explicit_model?: string | null;
	task_type?: string | null;
	/** The item's BRIEF note. */
	brief?: string | null;
}

export interface TrackerLaunchIntent {
	token: string;
	source: TrackerLaunchSource;
	target: string | null;
	scheduledPick?: TrackerLaunchPick;
}

export interface TrackerDispatchItem extends TrackerLaunchOptions, TrackerDispatchItemModel {
	id: string;
	title: string;
	notes?: string | null;
	kind: string;
	status: TrackerItemStatus;
	agent?: string | null;
	owner?: string | null;
	due?: string | null;
	createdBy?: string;
	adapterDueOwner?: string | null;
	recurring?: boolean;
	scheduleOff?: boolean;
	scheduleHoldReason?: string;
	deleted?: boolean;
	awaitingAnswer?: boolean;
	parkedUntil?: number;
	question?: string | null;
	/** The item journal has confirmed this answer wins over the current question and block. */
	answeredCurrentBlock?: boolean;
	blockedReason?: string | null;
	closedBySource?: boolean;
	/** Journal clock identifying the current completion while the item is done. */
	completionVersion?: string;
	updatedAt?: number;
	launch?: TrackerLaunchIntent | null;
}

export interface TrackerLaunchRung {
	id: string;
	cli: TaskSelection['provider'];
	model: string;
	effort?: string | null;
	pinned?: boolean;
	/** A watchdog relaunch of this lost run climbs one rung instead of resuming it. */
	climbFrom?: TrackerRetryAttempt;
}

/** What choosing the next rung needs to know about the attempt that failed. */
export type TrackerRetryAttempt = Pick<
	TrackerRunReceipt,
	'node' | 'id' | 'rung' | 'cli' | 'model' | 'effort' | 'pinned' | 'kind'
>;

export interface TrackerLaunchPick {
	rung: TrackerLaunchRung;
	kind: string;
	reason: string;
}

/** The service calls these synchronous decisions within the store transaction. */
export interface TrackerDispatchPolicy {
	node: string;
	hub?: boolean;
	enabled?: boolean;
	recoverDroppedSessions?: boolean;
	/** Live operator setting for unattended launches. Explicit launches use the host safety setting. */
	automaticEnabled?(): boolean;
	allowDelegatedAdapterDue?: boolean;
	timezone: string;
	now(): number;
	/** Resolve custom aliases and known nodes. Built-in fleet aliases are resolved locally. */
	resolveHost?(computer: string): string | null;
	chooseHost(
		item: TrackerDispatchItem,
		scope: { source: TrackerLaunchSource; requestedNode: string | null }
	): { node: string | null; why: string };
	/** Whether the requesting computer has an approved execution directory. */
	localRepoAvailable?(item: TrackerDispatchItem): boolean;
	opsWorkdirAvailable?(item: TrackerDispatchItem): boolean;
	/** A null rung allows capacity to be checked for an invalid model request. */
	admit(
		item: TrackerDispatchItem,
		intent: TrackerLaunchIntent,
		rung: TrackerLaunchRung | null
	): string | null;
	/** Why this computer may not start the provider now. */
	providerHold?(cli: string): string | null;
	pickModel(item: TrackerDispatchItem): TrackerLaunchPick | { error: string };
	/** The item's task type, recorded on each run for analytics. */
	taskType?(item: TrackerDispatchItem): string;
	retryModel(item: TrackerDispatchItem, run: TrackerRetryAttempt): TrackerLaunchRung | null;
	/** The replacement for an earlier choice the operator's provider preference now rules out. */
	redirectPick?(
		item: TrackerDispatchItem,
		rung: Pick<TrackerLaunchRung, 'cli' | 'model' | 'effort'>
	): TrackerLaunchPick | null;
	maxRetries?: number;
	maxRunMinutes?: number;
	stallMinutes?: number;
	defaultEtaMinutes?: number;
	dueIntervalMs?: number;
}

export interface TrackerDuePolicy {
	enabled: boolean;
	paused: boolean;
	localDue?: boolean;
	hubAllowsLocal?: boolean;
	adapterDue?: boolean;
}

export interface TrackerDueGrant {
	token: string;
	node: string;
	decision: 'granted' | 'denied' | 'unreachable';
}

export interface TrackerDispatchSnapshot {
	item: TrackerDispatchItem | null;
	/** Include all claims for this item, including imported peers and completed attempts. */
	runs: readonly TrackerRunReceipt[];
	/** Allocate atomically across all items for the local node. */
	nextRunId: number;
	/** A trusted session index matched live or recently active work without a run receipt. */
	openSession?: boolean;
	/** Managed session keys from the runner, including sessions for finished receipts. */
	activeSessionKeys?: readonly string[];
	due?: TrackerDuePolicy;
	lastDueStartAt?: number;
}

export interface TrackerDispatchWrites {
	item?: Partial<Omit<TrackerDispatchItem, 'id'>> & { appendNote?: string };
	runs?: readonly TrackerRunReceipt[];
	lastDueStartAt?: number;
	/** A run abandoned by a launch failure, rather than a cancellation, which is announced. */
	failedRunId?: number;
}

export type TrackerDispatchResult =
	| { status: 'requested' | 'existing'; intent: TrackerLaunchIntent }
	| { status: 'held' | 'conflict' | 'ignored'; reason: string }
	| { status: 'start'; run: TrackerRunReceipt; key: string; selection: TaskSelection }
	| { status: 'recorded'; run: TrackerRunReceipt; retry?: TrackerRunReceipt };

export interface TrackerDispatchDecision {
	result: TrackerDispatchResult;
	writes?: TrackerDispatchWrites;
}

export interface TrackerDispatchStore {
	/**
	 * Read the current item, policy and receipts and commit all writes as one serializable change.
	 * Return the result only after commit. Enforce uniqueness of (item, token, attempt) across
	 * claimants with an authoritative store or exclusive token ownership. A rolled-back
	 * decision must never release a start instruction. After losing a committed reservation,
	 * reconcile by its runner key before reporting a confirmed startup failure.
	 */
	update(
		itemId: string,
		decide: (snapshot: TrackerDispatchSnapshot) => TrackerDispatchDecision
	): Promise<TrackerDispatchResult>;
}

export type TrackerLaunchRequest =
	| {
			source: 'manual';
			token: string;
			options?: TrackerLaunchOptions;
	  }
	| { source: 'automatic'; token: string; unchangedSince: number }
	| { source: 'due'; token: string }
	| { source: 'recovery'; token: string; expectedAuto: string | null; rung?: TrackerLaunchRung };

export interface TrackerAttemptVersion {
	id: number;
	revision: number;
}
