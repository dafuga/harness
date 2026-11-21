// @harness-uid u_e7x5dhawh4
import type { TrackerNotificationSourceOptions } from '../TrackerNotificationSourceRepository.types';
import type {
	AttentionItemState,
	AttentionRow,
	CallbackRow,
	FlagRow,
	OutboxRow,
	ReminderRow
} from '../../../services/projects-sessions/tracker-notification-service/notificationState.types';
import type {
	StoredAttention,
	StoredAttentionItem,
	StoredCallback,
	StoredFlag,
	StoredOutbox,
	StoredReminder
} from './legacyQueueTables.types';
import type { QueueTable } from './queueTable.types';

export function callbackTable(
	resolve: TrackerNotificationSourceOptions['resolveDestination']
): QueueTable<CallbackRow, StoredCallback> {
	return {
		name: 'deliveries',
		columns: [
			'item_id',
			'target_id',
			'target',
			'events',
			'status',
			'attempts',
			'next_at',
			'last_error',
			'created_at',
			'done_at'
		],
		read: (row) => ({
			key: row.queue_key,
			itemId: row.item_id ?? '',
			targetId: row.target_id ?? '',
			legacyTarget: row.target,
			destination: row.status === 'pending' ? resolve(JSON.parse(row.target)) : undefined,
			events: row.events === null ? [] : JSON.parse(row.events),
			status: row.status,
			attempts: row.attempts,
			nextAt: row.next_at,
			lastError: row.last_error,
			createdAt: row.created_at,
			doneAt: row.done_at ?? undefined
		}),
		values: (row) => [
			row.itemId,
			row.targetId,
			row.legacyTarget ?? null,
			JSON.stringify(row.events),
			row.status,
			row.attempts,
			row.nextAt,
			row.lastError ?? null,
			row.createdAt,
			row.doneAt ?? null
		]
	};
}

export const outboxTable: QueueTable<OutboxRow, StoredOutbox> = {
	name: 'webhook_outbox',
	columns: [
		'kind',
		'item_id',
		'payload',
		'status',
		'attempts',
		'next_at',
		'last_error',
		'created_at',
		'sent_at'
	],
	read: (row) => ({
		key: row.queue_key,
		kind: row.kind,
		itemId: row.item_id,
		payload: JSON.parse(row.payload),
		status: row.status,
		attempts: row.attempts,
		nextAt: row.next_at,
		lastError: row.last_error,
		createdAt: row.created_at,
		sentAt: row.sent_at ?? undefined
	}),
	values: (row) => [
		row.kind,
		row.itemId,
		JSON.stringify(row.payload),
		row.status,
		row.attempts,
		row.nextAt,
		row.lastError ?? null,
		row.createdAt,
		row.sentAt ?? null
	]
};

export const reminderTable: QueueTable<ReminderRow, StoredReminder> = {
	name: 'reminders',
	columns: ['item_id', 'kind', 'status', 'created_at', 'next_at', 'pings', 'last_ping'],
	read: (row) => ({
		key: row.queue_key,
		itemId: row.item_id,
		kind: row.kind,
		status: row.status,
		createdAt: row.created_at,
		nextAt: row.next_at,
		pings: row.pings,
		lastPing: row.last_ping ?? undefined
	}),
	values: (row) => [
		row.itemId,
		row.kind,
		row.status,
		row.createdAt,
		row.nextAt,
		row.pings,
		row.lastPing ?? null
	]
};

export const flagTable: QueueTable<FlagRow, StoredFlag> = {
	name: 'webhook_flags',
	columns: ['item_id', 'status', 'created_at', 'next_at', 'escalation'],
	read: (row) => ({
		key: row.queue_key,
		itemId: row.item_id,
		status: row.status,
		createdAt: row.created_at,
		nextAt: row.next_at,
		escalation: row.escalation
	}),
	values: (row) => [row.itemId, row.status, row.createdAt, row.nextAt, row.escalation]
};

export const attentionTable: QueueTable<AttentionRow, StoredAttention> = {
	name: 'cos_queue',
	columns: ['kind', 'item_id', 'line', 'created_at', 'status', 'sent_at', 'batch_id'],
	read: (row) => ({
		key: row.queue_key,
		kind: row.kind,
		itemId: row.item_id,
		line: JSON.parse(row.line),
		createdAt: row.created_at,
		status: row.status,
		sentAt: row.sent_at ?? undefined,
		batchId: row.batch_id ?? undefined
	}),
	values: (row) => [
		row.kind,
		row.itemId,
		JSON.stringify(row.line),
		row.createdAt,
		row.status,
		row.sentAt ?? null,
		row.batchId ?? null
	]
};

export const attentionItemsTable: QueueTable<AttentionItemState, StoredAttentionItem> = {
	name: 'cos_state',
	key: 'item_id',
	columns: ['status', 'needs', 'resolved'],
	read: (row) => ({
		status: row.status,
		needs: Boolean(row.needs),
		resolved: Boolean(row.resolved)
	}),
	values: (row) => [row.status, Number(row.needs), Number(row.resolved)]
};
