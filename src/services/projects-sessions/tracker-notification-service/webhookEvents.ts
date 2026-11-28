// @harness-uid u_vqnqshfas2
import { isHiddenByReview } from './isHiddenByReview';
import type {
	TrackerNotificationItem,
	TrackerNotificationOp,
	TrackerNotificationSource,
	TrackerPayloadFields,
	TrackerWebhookEvent,
	TrackerWebhookOptions
} from '../TrackerNotificationService.types';
import type {
	TrackerNotificationState,
	WebhookEntryDetails,
	WebhookPayload
} from './notificationState.types';
import { attentionState, observeAttention } from './attentionTransitions';
import { initializeAttention } from './attentionInitialization';
import { TrackerNotificationStateError } from './TrackerNotificationStateError';
import { clockTime, eventId, isoTime } from './notificationRules';

const changedFields = ['status', 'due', 'question', 'answer', 'needs_daniel', 'deleted', 'owner'];
const recurringBookkeeping = new Set(['due', 'occurrence', 'missed', 'note+']);

export function enqueueEvent(
	state: TrackerNotificationState,
	event: WebhookPayload,
	timing: { key: string; now: number; nextAt?: number }
): void {
	const { key, now, nextAt = now } = timing;
	if (state.outbox.has(key)) return;
	state.outbox.set(key, {
		key,
		kind: event.event,
		itemId: event.item_id,
		status: 'pending',
		attempts: 0,
		payload: event,
		nextAt,
		createdAt: now
	});
}

export function itemEvent(
	item: TrackerNotificationItem,
	event: TrackerWebhookEvent,
	identity: { key: string; node: string; now: number },
	extra: WebhookEntryDetails = {}
): WebhookPayload {
	return {
		event_id: eventId([identity.key]),
		event,
		item_id: item.id,
		title: item.title,
		kind: item.kind,
		status: item.status,
		needs_daniel: !!item.needs_daniel && !item.resolved,
		owner: item.owner,
		waiter: item.agent,
		agent: item.agent,
		escalation: extra.escalation ?? 0,
		blocked_reason: item.status === 'blocked' ? item.blocked_reason : null,
		question: item.question,
		answer: item.answer,
		...(item.answer_option && {
			answer_option: Number(item.answer_option),
			answered_by: item.answered_by,
			answered_at: item.answered_at
		}),
		due: item.due,
		changed_fields: extra.changedFields,
		node: identity.node,
		occurred_at: isoTime(extra.at ?? identity.now),
		...extra.payload
	};
}

export function summaryEvent(
	key: string,
	source: TrackerNotificationSource,
	now: number,
	payload: TrackerPayloadFields
): WebhookPayload {
	return {
		event_id: eventId([key]),
		event: 'autolaunch',
		item_id: null,
		needs_daniel: false,
		escalation: 0,
		node: source.node,
		occurred_at: isoTime(now),
		...payload
	};
}

export function normalizeActor(value: string | null | undefined): string {
	return (value ?? '').trim().toLowerCase();
}

function isOwnChange(actor: string | null, item: TrackerNotificationItem): boolean {
	const name = normalizeActor(actor);
	return !!name && [item.owner, item.agent].some((value) => normalizeActor(value) === name);
}

function warrantsChanged(
	patch: TrackerNotificationOp['fields'],
	item: TrackerNotificationItem,
	fields: TrackerWebhookOptions['changedFields']
): boolean {
	if (!item.agent || 'created_at' in patch || patch.needs_daniel === 1) return false;
	return (
		fields === 'all' || Object.keys(patch).some((key) => (fields ?? changedFields).includes(key))
	);
}

function eventType(
	op: TrackerNotificationOp,
	item: TrackerNotificationItem,
	fields: TrackerWebhookOptions['changedFields']
): TrackerWebhookEvent | undefined {
	const patch = op.fields;
	if (patch.resolved === 1 || patch.resolved === true) return 'resolved';
	if (patch.status === 'blocked') return 'blocked';
	if (isOwnChange(op.actor, item)) return undefined;
	if (patch.status === 'done') return 'done';
	return warrantsChanged(patch, item, fields) ? 'changed' : undefined;
}

function classifyEvent(
	state: TrackerNotificationState,
	source: TrackerNotificationSource,
	op: TrackerNotificationOp,
	context: { settings: TrackerWebhookOptions; now: number }
): void {
	const item = source.item(op.item_id);
	if (!item?.title || item.status === 'ignored') return;
	if (isHiddenByReview(item, op.fields, op.fields.status === 'done')) return;
	if (
		item.every &&
		op.node === source.node &&
		Object.keys(op.fields).every((key) => recurringBookkeeping.has(key))
	)
		return;
	const kind = eventType(op, item, context.settings.changedFields);
	if (!kind) return;
	const { now } = context;
	const key = `${kind}|${op.item_id}|${op.hlc}`;
	const event = itemEvent(
		item,
		kind,
		{ key, node: source.node, now },
		{
			at: clockTime(op.hlc),
			changedFields: Object.keys(op.fields).map((field) => (field === 'note+' ? 'note' : field))
		}
	);
	enqueueEvent(state, event, { key, now });
}

function scanPage(
	state: TrackerNotificationState,
	source: TrackerNotificationSource,
	ops: readonly TrackerNotificationOp[],
	context: { settings: TrackerWebhookOptions; now: number }
): void {
	const touched = new Set<string>();
	for (const op of ops) {
		classifyEvent(state, source, op, context);
		if (context.settings.batch === false) continue;
		observeAttention(state, source, op, context.now);
		touched.add(op.item_id);
	}
	for (const id of touched) {
		const item = source.item(id);
		if (item) state.attentionItems.set(id, attentionState(item));
	}
}

export function scanWebhookEvents(
	state: TrackerNotificationState,
	source: TrackerNotificationSource,
	settings: TrackerWebhookOptions,
	now: number
): void {
	if (settings.batch !== false) initializeAttention(state, source, now);
	if (state.cursor === null) {
		state.cursor = source.maxSeq();
		return;
	}
	for (;;) {
		const ops = source.opsSince(state.cursor, 500);
		const last = ops.at(-1);
		if (!last) return;
		if (last.seq <= state.cursor)
			throw new TrackerNotificationStateError(
				'Tracker notification source returned a non-advancing cursor'
			);
		scanPage(state, source, ops, { settings, now });
		state.cursor = last.seq;
	}
}
