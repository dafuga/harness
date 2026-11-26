// @harness-uid u_vqnqshfas2
import { nextReminderSlotAt } from '../../../helpers/attention-timing/nextReminderSlotAt';
import type {
	TrackerNotificationItem,
	TrackerNotificationOptions
} from '../TrackerNotificationService.types';
import type { FlagRow, TrackerNotificationState } from './notificationState.types';
import {
	activeItem,
	clockTime,
	dueTime,
	flagged,
	holdRegularReminder,
	intervalMs,
	minute,
	nextAskAt
} from './notificationRules';
import { enqueueEvent, itemEvent } from './webhookEvents';

function nextEscalation(from: number, options: TrackerNotificationOptions): number {
	const slots = options.webhook?.reminderTimes;
	if (slots?.length) return nextReminderSlotAt(from, slots, options.source.tz);
	return from + intervalMs(options.reminderIntervalMinutes, 120);
}

function firstEscalation(
	state: TrackerNotificationState,
	item: TrackerNotificationItem,
	options: TrackerNotificationOptions,
	now: number
): Pick<FlagRow, 'nextAt' | 'escalation'> {
	const { status, needs_daniel: flag } = item.clocks;
	const blocked =
		item.status === 'blocked' && status === flag
			? state.outbox.get(`blocked|${item.id}|${status}`)
			: undefined;
	if (!blocked) return { nextAt: now, escalation: 0 };
	const firstAt = blocked.sentAt ?? Math.max(blocked.nextAt, now);
	return { nextAt: nextEscalation(firstAt, options), escalation: 1 };
}

function trackFlags(
	state: TrackerNotificationState,
	options: TrackerNotificationOptions,
	now: number
) {
	const active = new Map<string, TrackerNotificationItem>();
	for (const item of options.source.items()) {
		if (!flagged(item)) continue;
		const key = `${item.id}|${item.clocks.needs_daniel ?? ''}`;
		active.set(key, item);
		if (!state.flags.has(key))
			state.flags.set(key, {
				key,
				itemId: item.id,
				status: 'active',
				createdAt: clockTime(item.clocks.needs_daniel) || now,
				...firstEscalation(state, item, options, now)
			});
	}
	for (const row of state.flags.values()) {
		if (row.status === 'active' && !active.has(row.key)) row.status = 'closed';
	}
	return active;
}

export function scanWebhookFlags(
	state: TrackerNotificationState,
	options: TrackerNotificationOptions,
	now: number
): void {
	const active = trackFlags(state, options, now);
	const pending = [...state.flags.values()].filter((row) => {
		const item = active.get(row.key);
		return (
			row.status === 'active' &&
			item &&
			!holdRegularReminder(item, now, options.reminderIntervalMinutes)
		);
	});
	const due = pending.filter((row) => row.nextAt <= now);
	if (!due.length) return;
	const grace = options.webhook?.reminderTimes?.length
		? (options.webhook.coalesceMinutes ?? 10) * minute
		: 0;
	const near = pending.filter(
		(row) => row.escalation >= 1 && row.nextAt > now && row.nextAt <= now + grace
	);
	for (const row of [...due, ...near]) {
		const item = active.get(row.key);
		if (!item) continue;
		const key = `needs_daniel|${row.key}|${row.escalation}`;
		const event = itemEvent(
			item,
			'needs_daniel',
			{ key, node: options.source.node, now },
			{
				escalation: row.escalation,
				payload: {
					first_noticed_at: new Date(row.createdAt).toISOString(),
					waiting_minutes: Math.max(0, Math.floor((now - row.createdAt) / minute))
				}
			}
		);
		enqueueEvent(state, event, { key, now });
		row.escalation++;
		row.nextAt = nextFlagEscalation(state, item, row, { options, now });
	}
}

function nextFlagEscalation(
	state: TrackerNotificationState,
	item: TrackerNotificationItem,
	row: FlagRow,
	{ options, now }: { options: TrackerNotificationOptions; now: number }
): number {
	if (options.webhook?.reminderTimes?.length) return nextEscalation(now, options);
	const original = state.outbox.get(`needs_daniel|${row.key}|0`);
	const blocked = state.outbox.get(`blocked|${item.id}|${item.clocks.needs_daniel}`);
	const first = original ?? blocked;
	return nextAskAt(row.escalation, first?.sentAt ?? first?.createdAt ?? now, now);
}

export function scanWebhookDue(
	state: TrackerNotificationState,
	options: TrackerNotificationOptions,
	now: number
): void {
	const { source } = options;
	for (const item of source.items()) {
		if (
			!activeItem(item) ||
			item.kind === 'reminder' ||
			item.every ||
			holdRegularReminder(item, now, options.reminderIntervalMinutes)
		)
			continue;
		const at = dueTime(item.due, source.tz);
		if (at === null || at > now) continue;
		const key = `due|${item.id}|${item.clocks.due}`;
		if (state.outbox.has(key)) continue;
		const event = itemEvent(item, 'due', { key, node: source.node, now }, { at });
		enqueueEvent(state, event, { key, now });
	}
}
