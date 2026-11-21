// @harness-uid u_vqnqshfas2
import { nextReminderAt } from '../../../helpers/attention-timing/nextReminderAt';
import { nextReminderSlotAt } from '../../../helpers/attention-timing/nextReminderSlotAt';
import { quietHourBoundary } from '../../../helpers/attention-timing/quietHourBoundary';
import type {
	TrackerNotificationItem,
	TrackerNotificationOptions
} from '../TrackerNotificationService.types';
import type { FlagRow, TrackerNotificationState } from './notificationState.types';
import { activeItem, dueTime, flagged, intervalMs, minute } from './notificationRules';
import { enqueueEvent, itemEvent } from './webhookEvents';

function nextEscalation(from: number, options: TrackerNotificationOptions): number {
	const { quietHours, source } = options;
	const slots = options.webhook?.reminderTimes;
	if (slots?.length) {
		const slot = nextReminderSlotAt(from, slots, quietHours?.tz ?? source.tz);
		return quietHourBoundary(slot, quietHours);
	}
	return nextReminderAt(from, intervalMs(options.reminderIntervalMinutes, 60), quietHours);
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
	const initial = quietHourBoundary(now, options.quietHours);
	if (!blocked) return { nextAt: initial, escalation: 0 };
	const firstAt =
		blocked.sentAt ?? quietHourBoundary(Math.max(blocked.nextAt, now), options.quietHours);
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
				createdAt: now,
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
	const pending = [...state.flags.values()].filter((row) => row.status === 'active');
	const due = pending.filter((row) => row.nextAt <= now);
	if (!due.length) return;
	const release = quietHourBoundary(now, options.quietHours);
	if (release > now) {
		for (const row of due) row.nextAt = release;
		return;
	}
	const grace = (options.webhook?.coalesceMinutes ?? 10) * minute;
	const near = pending.filter(
		(row) => row.escalation >= 1 && row.nextAt > now && row.nextAt <= now + grace
	);
	const nextAt = nextEscalation(now, options);
	for (const row of [...due, ...near]) {
		const item = active.get(row.key);
		if (!item) continue;
		const key = `needs_daniel|${row.key}|${row.escalation}`;
		const event = itemEvent(
			item,
			'needs_daniel',
			{ key, node: options.source.node, now },
			{ escalation: row.escalation }
		);
		enqueueEvent(state, event, { key, now });
		row.nextAt = nextAt;
		row.escalation++;
	}
}

export function scanWebhookDue(
	state: TrackerNotificationState,
	options: TrackerNotificationOptions,
	now: number
): void {
	const { source } = options;
	const nextAt = quietHourBoundary(now, options.quietHours);
	for (const item of source.items()) {
		if (!activeItem(item) || item.every) continue;
		const at = dueTime(item.due, source.tz);
		if (at === null || at > now) continue;
		const key = `due|${item.id}|${item.clocks.due}`;
		if (state.outbox.has(key)) continue;
		const event = itemEvent(item, 'due', { key, node: source.node, now }, { at });
		enqueueEvent(state, event, { key, now, nextAt });
	}
}
