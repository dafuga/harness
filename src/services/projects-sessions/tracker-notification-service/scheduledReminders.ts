// @harness-uid u_vqnqshfas2
import type {
	TrackerDestination,
	TrackerNotificationItem,
	TrackerNotificationOptions,
	TrackerNotificationSource
} from '../TrackerNotificationService.types';
import { callbackRequest, webhookRequest } from './deliveryRequest';
import { activeItem, eventId, isoTime, parkedUntil, readyRows } from './notificationRules';
import type { DeliveryAttempt, TrackerNotificationState } from './notificationState.types';

function scheduledKey(item: TrackerNotificationItem): string {
	return `remind_at|${item.id}|${item.clocks.remind_at}`;
}

function scheduledDestination(options: TrackerNotificationOptions) {
	const { chiefOfStaff, webhook, scheduledReminders, destinations } = options;
	const destination = [chiefOfStaff, webhook?.destination, scheduledReminders].find(
		(target) => target && destinations.available(target)
	);
	return (
		destination && {
			destination,
			webhook: destination === webhook?.destination && destination !== chiefOfStaff
		}
	);
}

export function scanScheduledReminders(
	state: TrackerNotificationState,
	options: TrackerNotificationOptions,
	now: number
): void {
	if (options.role !== 'hub' || !scheduledDestination(options)) return;
	const { source } = options;
	for (const item of source.scheduledItems?.(now) ?? source.items()) {
		if (!activeScheduledItem(item)) continue;
		const at = readyTime(item, now);
		if (at === undefined) continue;
		const key = scheduledKey(item);
		if (!state.reminders.has(key))
			state.reminders.set(key, {
				key,
				itemId: item.id,
				kind: 'scheduled',
				status: 'active',
				createdAt: at,
				nextAt: at,
				pings: 0
			});
	}
}

function readyTime(item: TrackerNotificationItem, now: number): number | undefined {
	const at = Date.parse(item.remind_at ?? '');
	return item.clocks.remind_at && at <= now ? at : undefined;
}

export function nextScheduledReminder(
	state: TrackerNotificationState,
	options: TrackerNotificationOptions,
	now: number
): DeliveryAttempt | undefined {
	if (options.role !== 'hub') return undefined;
	const target = scheduledDestination(options);
	if (!target) return undefined;
	const { source } = options;
	for (const row of readyRows(state.reminders.values(), now, isPending)) {
		const item = source.item(row.itemId);
		if (!matchesScheduledItem(item, row.key)) {
			row.status = 'closed';
			continue;
		}
		if (parkedUntil(item) > now) continue;
		const request = scheduledRequest(
			item,
			eventId(row.pings ? [row.key, String(row.pings)] : [row.key]),
			target.destination,
			{
				source,
				now,
				webhook: target.webhook,
				reminderNumber: row.pings
			}
		);
		return { kind: 'scheduled', keys: [row.key], request, startedAt: now };
	}
	return undefined;
}

function isPending(row: { kind: string; status: string }): boolean {
	return row.kind === 'scheduled' && row.status === 'active';
}

function scheduledRequest(
	item: TrackerNotificationItem,
	id: string,
	target: TrackerDestination,
	{
		source,
		now,
		webhook,
		reminderNumber
	}: { source: TrackerNotificationSource; now: number; webhook: boolean; reminderNumber: number }
) {
	const { node } = source;
	const reminder = {
		id: item.id,
		title: item.title,
		kind: item.kind,
		question: item.question,
		due: item.due,
		owner: item.owner,
		agent: item.agent,
		reason: 'remind_at',
		remind_at: item.remind_at,
		reminder_number: reminderNumber,
		first_noticed_at: item.remind_at
	};
	if (!webhook)
		return callbackRequest(id, target, {
			type: 'attention',
			new: reminderNumber ? [] : [reminder],
			reminders: reminderNumber ? [reminder] : [],
			...(target.kind === 'http' && { digest: source.digest(now) }),
			node,
			sent_at: isoTime(now)
		});
	return webhookRequest(target, {
		event_id: id,
		event: 'attention',
		to: 'chief_of_staff',
		batch: true,
		count: 1,
		counts: { needs_daniel: 1, blocked: 0, done: 0 },
		items: [{ ...reminder, event: 'needs_daniel', item_id: item.id, at: item.remind_at }],
		text: `REMINDER [${item.id.slice(0, 6)}]: ${item.title}`,
		node,
		sent_at: isoTime(now)
	});
}

export function currentScheduledAttempt(
	state: TrackerNotificationState,
	attempt: DeliveryAttempt,
	source: TrackerNotificationSource
): boolean {
	const row = state.reminders.get(attempt.keys[0]);
	const item = row && source.item(row.itemId);
	if (matchesScheduledItem(item, row?.key)) return true;
	if (row) row.status = 'closed';
	return false;
}

function activeScheduledItem(
	item: TrackerNotificationItem | undefined
): item is TrackerNotificationItem {
	return activeItem(item) && (item.kind !== 'reminder' || item.status !== 'blocked');
}

function matchesScheduledItem(
	item: TrackerNotificationItem | undefined,
	key?: string
): item is TrackerNotificationItem {
	return activeScheduledItem(item) && Boolean(item.remind_at) && key === scheduledKey(item);
}

export function isScheduledReminderAttempt(
	state: TrackerNotificationState,
	attempt: DeliveryAttempt,
	source: TrackerNotificationSource
) {
	const row = attempt.kind === 'scheduled' && state.reminders.get(attempt.keys[0]);
	return row && source.item(row.itemId)?.kind === 'reminder';
}
