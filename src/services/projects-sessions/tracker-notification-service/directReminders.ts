// @harness-uid u_vqnqshfas2
import { quietHourBoundary } from '../../../helpers/attention-timing/quietHourBoundary';
import type {
	TrackerDestination,
	TrackerNotificationItem,
	TrackerNotificationOptions
} from '../TrackerNotificationService.types';
import type {
	DeliveryAttempt,
	ReminderRow,
	DirectReminderBrief,
	TrackerNotificationState
} from './notificationState.types';
import { callbackRequest, flagWebhook } from './deliveryRequest';
import {
	askQuietHours,
	clockTime,
	directReminderDestination,
	dueForDirectReminder,
	eventId,
	flagged,
	holdRegularReminder,
	isoTime,
	localDay,
	minute,
	nextAskAt,
	readyRows
} from './notificationRules';

function reminderRows(
	state: TrackerNotificationState,
	options: TrackerNotificationOptions,
	now: number
) {
	const { source } = options;
	const reminders = [];
	const today = localDay(now, source.tz);
	const nextAt = quietHourBoundary(now, options.quietHours);
	for (const item of source.items()) {
		const row = { itemId: item.id, status: 'active', nextAt, createdAt: now, pings: 0 } as const;
		if (flagged(item)) {
			const flag = flagReminder(
				state,
				item,
				now,
				!options.chiefOfStaff && Boolean(options.webhook)
			);
			if (flag) reminders.push(flag);
		}
		if (dueForDirectReminder(item, options, today))
			reminders.push({
				...row,
				key: `due|${item.id}|${item.clocks.due ?? ''}`,
				kind: 'due'
			} as const);
	}
	// Legacy inserts the flag rows first, then today's outstanding due rows.
	return reminders.sort((a, b) => Number(a.kind === 'due') - Number(b.kind === 'due'));
}

function reminderKey(item: TrackerNotificationItem): string {
	return `flag|${item.id}|${item.clocks.needs_daniel ?? ''}`;
}

function flagReminder(
	state: TrackerNotificationState,
	item: TrackerNotificationItem,
	now: number,
	batched: boolean
): ReminderRow | undefined {
	const key = reminderKey(item);
	const initial = batched ? initialBatch(state, item, key) : undefined;
	if (initial?.status === 'pending') return undefined;
	const createdAt =
		clockTime(item.clocks.needs_daniel) || Date.parse(initial?.line.at ?? '') || now;
	const firstPing = initial?.sentAt;
	return {
		key,
		itemId: item.id,
		kind: 'flag',
		status: 'active',
		createdAt,
		nextAt:
			firstPing === undefined
				? quietHourBoundary(now, askQuietHours)
				: nextAskAt(1, firstPing, firstPing),
		pings: Number(firstPing !== undefined),
		firstPing
	};
}

function initialBatch(state: TrackerNotificationState, item: TrackerNotificationItem, key: string) {
	const clock = item.clocks.needs_daniel;
	const row =
		state.attention.get(key) ??
		(item.clocks.status === clock ? state.attention.get(`blocked|${item.id}|${clock}`) : undefined);
	if (row || clock) return row;
	return [...state.attention.values()]
		.reverse()
		.find(
			(entry) =>
				entry.itemId === item.id && (entry.kind === 'needs_daniel' || entry.line.needs_daniel)
		);
}

export function scanDirectReminders(
	state: TrackerNotificationState,
	options: TrackerNotificationOptions,
	now: number
): void {
	if (!directReminderDestination(options)) return;
	const active = new Set<string>();
	for (const row of reminderRows(state, options, now)) {
		active.add(row.key);
		if (!state.reminders.has(row.key)) state.reminders.set(row.key, row);
	}
	for (const row of state.reminders.values()) {
		if (row.kind === 'scheduled' || row.status !== 'active') continue;
		if (!active.has(row.key) && !currentFlag(row, options.source.item(row.itemId)))
			row.status = 'closed';
	}
}

function currentFlag(row: ReminderRow, item: TrackerNotificationItem | undefined) {
	return row.kind === 'flag' && flagged(item) && row.key === reminderKey(item);
}

function brief(row: ReminderRow, item: TrackerNotificationItem, now: number): DirectReminderBrief {
	const askedAt =
		row.kind === 'flag' ? clockTime(item.clocks.needs_daniel) || row.createdAt : row.createdAt;
	return {
		id: item.id,
		title: item.title,
		kind: item.kind,
		question: item.question,
		due: item.due,
		owner: item.owner,
		agent: item.agent,
		reason: row.kind === 'flag' ? 'needs_daniel' : 'due',
		reminder_number: row.pings,
		first_noticed_at: isoTime(askedAt),
		...(row.kind === 'flag' && {
			waiting_minutes: Math.max(0, Math.floor((now - askedAt) / minute))
		})
	};
}

export function nextDirectReminder(
	state: TrackerNotificationState,
	options: TrackerNotificationOptions,
	destination: TrackerDestination,
	now: number
): DeliveryAttempt | undefined {
	const batched =
		destination === options.webhook?.destination && destination !== options.chiefOfStaff;
	const due = readyRows(
		state.reminders.values(),
		now,
		(row) => row.kind !== 'scheduled' && row.status === 'active'
	);
	const fresh: DirectReminderBrief[] = [];
	const repeat: DirectReminderBrief[] = [];
	const pending = [];
	for (const row of due) {
		const item = readyReminder(state, row, { options, now, batched });
		if (!item) continue;
		pending.push(row);
		(row.pings ? repeat : fresh).push(brief(row, item, now));
		if (destination === options.scheduledReminders) break;
	}
	if (!pending.length) return undefined;
	const id = eventId(pending.map((row) => `${row.key}|${row.pings}`));
	const request = batched
		? flagWebhook(destination, id, [...fresh, ...repeat], { node: options.source.node, now })
		: callbackRequest(id, destination, {
				type: 'attention',
				new: fresh,
				reminders: repeat,
				...(destination.kind === 'http' && { digest: options.source.digest(now) }),
				node: options.source.node,
				sent_at: isoTime(now)
			});
	return { kind: 'reminders', keys: pending.map((row) => row.key), request, startedAt: now };
}

function readyReminder(
	state: TrackerNotificationState,
	row: ReminderRow,
	{ options, now, batched }: { options: TrackerNotificationOptions; now: number; batched: boolean }
) {
	const item = options.source.item(row.itemId);
	if (!item || (row.kind === 'flag' && !currentFlag(row, item))) {
		row.status = 'closed';
		return undefined;
	}
	const release = quietHourBoundary(now, row.kind === 'flag' ? askQuietHours : options.quietHours);
	if (release > now) {
		row.nextAt = release;
		return undefined;
	}
	if (batched && initialBatch(state, item, row.key)?.status === 'pending') return undefined;
	return holdRegularReminder(item, now, options.reminderIntervalMinutes) ? undefined : item;
}

export function currentDirectAttempt(
	state: TrackerNotificationState,
	attempt: DeliveryAttempt,
	options: TrackerNotificationOptions
) {
	return attempt.keys.every((key) => {
		const row = state.reminders.get(key);
		if (row?.status !== 'active') return false;
		return row.kind !== 'flag' || currentFlag(row, options.source.item(row.itemId));
	});
}
