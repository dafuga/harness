import type {
	TrackerDeliveryRequest,
	TrackerDestination,
	TrackerWebhookEvent
} from '../TrackerNotificationService.types';

export type CallbackEvent = 'done' | 'resolved';
export type AttentionKind = 'needs_daniel' | 'launch_wait' | 'blocked' | 'done';
export type ReminderKind = 'flag' | 'due';

export interface RetryRow {
	key: string;
	createdAt: number;
	nextAt: number;
	attempts: number;
	lastError?: string | null;
}

export interface CallbackRow extends RetryRow {
	itemId: string;
	targetId: string;
	destination: TrackerDestination;
	events: CallbackEvent[];
	status: 'pending' | 'ok' | 'failed';
	doneAt?: number;
}

export interface WebhookPayload extends Record<string, unknown> {
	event_id: string;
	event: TrackerWebhookEvent;
	item_id: string | null;
	needs_daniel: boolean;
	escalation: number;
	owner?: string | null;
	agent?: string | null;
}

export interface OutboxRow extends RetryRow {
	kind: TrackerWebhookEvent;
	itemId: string | null;
	payload: WebhookPayload;
	status: 'pending' | 'sent' | 'dropped' | 'failed';
	sentAt?: number;
}

export interface ReminderRow {
	key: string;
	itemId: string;
	kind: ReminderKind;
	status: 'active' | 'closed';
	createdAt: number;
	nextAt: number;
	pings: number;
	lastPing?: number;
}

export interface FlagRow {
	key: string;
	itemId: string;
	status: 'active' | 'closed';
	nextAt: number;
	escalation: number;
	createdAt: number;
}

export interface AttentionPayload extends Record<string, unknown> {
	event: AttentionKind;
	item_id: string;
	title: string | null;
	at: string;
}

export interface AttentionRow {
	key: string;
	kind: AttentionKind;
	itemId: string;
	line: AttentionPayload;
	createdAt: number;
	status: 'pending' | 'dropped' | 'sent';
	sentAt?: number;
	batchId?: string;
}

export interface AttentionItemState {
	status: string | null;
	needs: boolean;
	resolved: boolean;
}

export interface DeliveryAttempt {
	kind: 'callback' | 'reminders' | 'outbox' | 'attention';
	keys: string[];
	request: TrackerDeliveryRequest;
	startedAt: number;
}

export interface TrackerNotificationState {
	callbacks: Map<string, CallbackRow>;
	reminders: Map<string, ReminderRow>;
	flags: Map<string, FlagRow>;
	outbox: Map<string, OutboxRow>;
	attention: Map<string, AttentionRow>;
	attentionItems: Map<string, AttentionItemState>;
	cursor: number | null;
	attentionInitialized?: boolean;
	paused?: { at: number; by: string | null };
	forceAttention?: boolean;
	lastAttentionAttempt?: number;
	lastAttentionSent?: number;
	lastAttentionError?: string;
	inFlight?: DeliveryAttempt;
}
