// @harness-uid u_vqnqshfas2
import type {
	TrackerNotificationItem,
	TrackerNotificationSource
} from '../TrackerNotificationService.types';
import type { TrackerNotificationState } from './notificationState.types';
import { attentionState, enqueueTransition, needsAttention } from './attentionTransitions';
import { clockTime } from './notificationRules';

function transitionDuringPause(item: TrackerNotificationItem, pausedAt: number) {
	const { status, needs_daniel: flag } = item.clocks;
	const statusAt = clockTime(status);
	if (status && statusAt >= pausedAt && (item.status === 'done' || item.status === 'blocked')) {
		return { event: item.status, clock: status, at: statusAt } as const;
	}
	const flagAt = clockTime(flag);
	if (flag && flagAt >= pausedAt && needsAttention(attentionState(item))) {
		return { event: 'needs_daniel', clock: flag, at: flagAt } as const;
	}
	return undefined;
}

function queueDuringPause(
	state: TrackerNotificationState,
	source: TrackerNotificationSource,
	item: TrackerNotificationItem,
	now: number
): void {
	const pausedAt = state.paused?.at;
	if (pausedAt === undefined) return;
	const transition = transitionDuringPause(item, pausedAt);
	if (!transition) return;
	const delivered = [...state.outbox.values()].some(
		(row) =>
			row.itemId === item.id &&
			row.status === 'sent' &&
			row.createdAt >= pausedAt &&
			['needs_daniel', 'blocked', 'done'].includes(row.kind)
	);
	if (delivered) return;
	const note = transition.event === 'done' ? source.latestNote(item.id) : undefined;
	enqueueTransition(state, item, transition.event, { ...transition, now, note });
}

function legacyAttentionRows(state: TrackerNotificationState) {
	const candidates = new Set<string>();
	const sent = new Set<string>();
	for (const row of state.outbox.values()) {
		if (!row.itemId || !['needs_daniel', 'blocked'].includes(row.kind)) continue;
		if (row.status === 'pending' || row.status === 'failed') candidates.add(row.itemId);
		if (row.status === 'sent')
			sent.add(row.kind === 'blocked' ? row.key : row.key.slice(0, row.key.lastIndexOf('|')));
	}
	return { candidates, sent };
}

function queueLegacyAttention(
	state: TrackerNotificationState,
	item: TrackerNotificationItem,
	sent: ReadonlySet<string>,
	now: number
): void {
	const { id, clocks } = item;
	const { status, needs_daniel: flag } = clocks;
	if (sent.has(`needs_daniel|${id}|${flag}`)) return;
	if (item.status === 'blocked' && !sent.has(`blocked|${id}|${status}`)) {
		enqueueTransition(state, item, 'blocked', { clock: status, now, at: clockTime(status) });
	} else if (needsAttention(attentionState(item)) && !sent.has(`blocked|${id}|${flag}`)) {
		enqueueTransition(state, item, 'needs_daniel', { clock: flag, now, at: clockTime(flag) });
	}
}

function migrateLegacyAttention(
	state: TrackerNotificationState,
	source: TrackerNotificationSource,
	now: number
): void {
	const { candidates, sent } = legacyAttentionRows(state);
	for (const id of candidates) {
		const item = source.item(id);
		if (item?.title && !item.deleted && item.status !== 'ignored') {
			queueLegacyAttention(state, item, sent, now);
		}
	}
}

export function initializeAttention(
	state: TrackerNotificationState,
	source: TrackerNotificationSource,
	now: number
): void {
	if (state.attentionInitialized) return;
	for (const item of source.items()) {
		if (item.title === null) continue;
		state.attentionItems.set(item.id, attentionState(item));
		if (!item.deleted && item.status !== 'ignored') queueDuringPause(state, source, item, now);
	}
	migrateLegacyAttention(state, source, now);
	state.attentionInitialized = true;
}
