// @harness-uid u_e7x5dhawh4
import type {
	AttentionRow,
	CallbackRow,
	FlagRow,
	OutboxRow,
	ReminderRow
} from '../../../services/projects-sessions/tracker-notification-service/notificationState.types';

interface StoredRetryFields {
	attempts: number;
	next_at: number;
	created_at: number;
	last_error: string | null;
}

export interface StoredCallback extends StoredRetryFields {
	queue_key: string;
	item_id: string | null;
	target_id: string | null;
	target: string;
	events: string | null;
	status: CallbackRow['status'];
	done_at: number | null;
}

export interface StoredOutbox extends StoredRetryFields {
	queue_key: string;
	kind: OutboxRow['kind'];
	item_id: string | null;
	payload: string;
	status: OutboxRow['status'];
	sent_at: number | null;
}

export interface StoredReminder {
	queue_key: string;
	item_id: string;
	kind: ReminderRow['kind'];
	status: ReminderRow['status'];
	created_at: number;
	next_at: number;
	pings: number;
	last_ping: number | null;
}

export interface StoredFlag {
	queue_key: string;
	item_id: string;
	status: FlagRow['status'];
	created_at: number;
	next_at: number;
	escalation: number;
}

export interface StoredAttention {
	queue_key: string;
	kind: AttentionRow['kind'];
	item_id: string;
	line: string;
	created_at: number;
	status: AttentionRow['status'];
	sent_at: number | null;
	batch_id: string | null;
}

export interface StoredAttentionItem {
	status: string | null;
	needs: number;
	resolved: number;
}
