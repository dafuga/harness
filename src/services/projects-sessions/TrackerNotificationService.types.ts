// @harness-uid u_vqnqshfas2
import type { QuietHours } from '../../helpers/attention-timing/attentionTiming.types';
import type { TrackerNotificationState } from './tracker-notification-service/notificationState.types';

export interface TrackerDestination {
	kind: 'http' | 'command';
	/** Stable, opaque destination reference. The adapter owns resolution. */
	id: string;
}

export interface TrackerItemCallback extends TrackerDestination {
	node: string;
}

export interface TrackerNotificationItem {
	id: string;
	title: string | null;
	kind: string | null;
	status: string | null;
	needs_daniel: boolean | number;
	resolved: boolean | number;
	deleted: boolean | number;
	owner: string | null;
	agent: string | null;
	due: string | null;
	question: string | null;
	answer: string | null;
	blocked_reason: string | null;
	clocks: Readonly<Record<string, string | undefined>>;
	notes?: string | null;
	callback?: TrackerItemCallback | null;
	every?: string | null;
	occurrence?: string | null;
	auto?: string | null;
}

export interface TrackerNotificationOp {
	seq: number;
	item_id: string;
	hlc: string;
	node: string;
	actor: string | null;
	fields: Readonly<Record<string, unknown>>;
}

export interface TrackerNotificationSource {
	node: string;
	tz: string;
	createdAt: number;
	items(): readonly TrackerNotificationItem[];
	item(id: string): TrackerNotificationItem | undefined;
	agent(name: string): { name: string; target: TrackerDestination; createdAt: number } | undefined;
	maxSeq(): number;
	/** Return up to limit operations in ascending sequence order. */
	opsSince(seq: number, limit: number): readonly TrackerNotificationOp[];
	publicItem(id: string): unknown;
	digest(now: number): unknown;
	latestNote(id: string): string | undefined;
	launchStarted(id: string, token: string): boolean;
}

export interface TrackerNotificationQueue {
	/** Atomically persist mutations to the draft or keep the previous state on error. */
	update<T>(change: (draft: TrackerNotificationState) => T): T;
	/** Serialize workers sharing this durable queue, across the send and outcome commit. */
	exclusive<T>(work: () => Promise<T>): Promise<T>;
}

export interface TrackerDeliveryRequest {
	/** Idempotency key at the destination, stable across an uncertain send and restart. */
	id: string;
	destination: TrackerDestination;
	body: string;
	headers?: Readonly<Record<string, string>>;
	environment?: Readonly<Record<string, string>>;
}

export type TrackerDeliveryResult = { status: 'sent' } | { status: 'rejected'; error: string };

export interface TrackerNotificationDestinations {
	available(destination: TrackerDestination): boolean;
	/**
	 * Deliver or replay the receipt for (destination, id). Return rejected only when no
	 * side effect occurred, with a safe diagnostic. Throw for uncertain outcomes.
	 */
	send(request: TrackerDeliveryRequest): Promise<TrackerDeliveryResult>;
}

export type TrackerWebhookEvent =
	| 'needs_daniel'
	| 'due'
	| 'blocked'
	| 'done'
	| 'resolved'
	| 'changed'
	| 'recurring_due'
	| 'autolaunch';

export interface TrackerWebhookRoute {
	destination: TrackerDestination;
	aliases?: readonly string[];
}

export interface TrackerWebhookOptions {
	destination: TrackerDestination;
	routes?: Readonly<Record<string, TrackerWebhookRoute>>;
	unrouted?: Partial<Record<TrackerWebhookEvent, 'cos' | 'drop'>>;
	changedFields?: 'all' | readonly string[];
	batch?: boolean;
	windowMinutes?: number;
	urgent?: readonly string[];
	quietHours?: boolean;
	coalesceMinutes?: number;
	reminderTimes?: readonly string[];
}

export interface TrackerNotificationOptions {
	source: TrackerNotificationSource;
	queue: TrackerNotificationQueue;
	destinations: TrackerNotificationDestinations;
	now: () => number;
	role: 'hub' | 'spoke';
	quietHours?: QuietHours | null;
	chiefOfStaff?: TrackerDestination;
	webhook?: TrackerWebhookOptions;
	reminderIntervalMinutes?: number;
	retryMinutes?: number;
}

/** Extensible legacy event fields serialized by the notification transport. */
export type TrackerPayloadFields = Record<string, unknown>;

export type TrackerWebhookEnqueue =
	| {
			kind: 'recurring_due';
			key: string;
			itemId: string;
			at: number;
			payload: TrackerPayloadFields;
	  }
	| { kind: 'autolaunch'; key: string; payload: TrackerPayloadFields }
	| { kind: 'launch_wait'; itemId: string; computer: string; reason: string };

export type { TrackerNotificationState };
