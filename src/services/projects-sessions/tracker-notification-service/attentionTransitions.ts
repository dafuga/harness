// @harness-uid u_vqnqshfas2
import { isHiddenByReview } from './isHiddenByReview';
import type {
	TrackerNotificationItem,
	TrackerNotificationOp,
	TrackerNotificationSource
} from '../TrackerNotificationService.types';
import type {
	AttentionItemState,
	AttentionKind,
	AttentionPayload,
	TrackerNotificationState
} from './notificationState.types';
import { clockTime, isoTime } from './notificationRules';

export function attentionState(item: TrackerNotificationItem): AttentionItemState {
	return { status: item.status, needs: !!item.needs_daniel, resolved: !!item.resolved };
}

export function needsAttention(state: AttentionItemState): boolean {
	return state.needs && !state.resolved && state.status !== 'done' && state.status !== 'ignored';
}

function queueLine(
	state: TrackerNotificationState,
	line: AttentionPayload,
	key: string,
	now: number
): void {
	if (state.attention.has(key)) return;
	for (const row of state.attention.values()) {
		if (row.status === 'pending' && row.itemId === line.item_id && row.kind === line.event)
			row.status = 'dropped';
	}
	state.attention.set(key, {
		key,
		kind: line.event,
		itemId: line.item_id,
		line,
		createdAt: now,
		status: 'pending'
	});
}

function transitionFields(
	item: TrackerNotificationItem,
	event: Exclude<AttentionKind, 'launch_wait'>,
	note?: string
) {
	if (event === 'blocked')
		return {
			reason: item.blocked_reason,
			needs_daniel: !!item.needs_daniel && !item.resolved
		};
	if (event === 'needs_daniel') return { question: item.question };
	const text = note?.length ? note : item.notes;
	return { result: text?.length ? text.slice(0, 400) : null };
}

export function enqueueTransition(
	state: TrackerNotificationState,
	item: TrackerNotificationItem,
	event: Exclude<AttentionKind, 'launch_wait'>,
	timing: { clock: string | undefined; now: number; at: number; note?: string }
): void {
	const line = {
		event,
		item_id: item.id,
		title: item.title,
		owner: item.owner,
		agent: item.agent,
		at: isoTime(timing.at)
	};
	const fields = transitionFields(item, event, timing.note);
	const kind = event === 'needs_daniel' ? 'flag' : event;
	queueLine(state, { ...line, ...fields }, `${kind}|${item.id}|${timing.clock}`, timing.now);
}

function applyAttentionPatch(
	previous: AttentionItemState,
	fields: TrackerNotificationOp['fields']
): AttentionItemState {
	const status = 'status' in fields ? (fields.status as string | null) : previous.status;
	const needs = 'needs_daniel' in fields ? Boolean(fields.needs_daniel) : previous.needs;
	const resolved = 'resolved' in fields ? Boolean(fields.resolved) : previous.resolved;
	return { status, needs, resolved };
}

function attentionTransition(
	previous: AttentionItemState,
	next: AttentionItemState
): Exclude<AttentionKind, 'launch_wait'> | undefined {
	if (next.status === 'done' && previous.status !== 'done') return 'done';
	if (next.status === 'blocked' && previous.status !== 'blocked') return 'blocked';
	return needsAttention(next) && !needsAttention(previous) ? 'needs_daniel' : undefined;
}

export function observeAttention(
	state: TrackerNotificationState,
	source: TrackerNotificationSource,
	op: TrackerNotificationOp,
	now: number
): void {
	const item = source.item(op.item_id);
	const { fields } = op;
	if (!item?.title || !['status', 'needs_daniel', 'resolved'].some((key) => key in fields)) return;
	const previous = state.attentionItems.get(item.id) ?? {
		status: null,
		needs: false,
		resolved: false
	};
	const next = applyAttentionPatch(previous, fields);
	state.attentionItems.set(item.id, next);
	if (item.deleted || [item.status, next.status].includes('ignored')) return;

	const event = attentionTransition(previous, next);
	if (!event || isHiddenByReview(item, fields, event === 'done')) return;
	const note = event === 'done' ? source.latestNote(item.id) : undefined;
	enqueueTransition(state, item, event, { clock: op.hlc, now, at: clockTime(op.hlc) || now, note });
}

export function launchWaitLine(
	item: TrackerNotificationItem,
	work: { computer: string; reason: string },
	now: number
): AttentionPayload {
	return {
		event: 'launch_wait',
		item_id: item.id,
		title: item.title,
		computer: work.computer,
		reason: work.reason,
		token: item.auto,
		at: isoTime(now)
	};
}

export function queueLaunchWait(
	state: TrackerNotificationState,
	line: AttentionPayload,
	key: string,
	now: number
): void {
	const existing = state.attention.get(key);
	if (existing?.status === 'pending') existing.line = line;
	if (!existing)
		state.attention.set(key, {
			key,
			itemId: line.item_id,
			kind: 'launch_wait',
			line,
			createdAt: now,
			status: 'pending'
		});
}
