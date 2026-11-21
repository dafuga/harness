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
	TrackerNotificationState
} from './notificationState.types';
import { callbackRequest } from './deliveryRequest';
import {
	activeItem,
	dueTime,
	eventId,
	flagged,
	isoTime,
	localDay,
	readyRows
} from './notificationRules';

function reminderRows(options: TrackerNotificationOptions, now: number) {
	const { source } = options;
	const reminders = [];
	const today = localDay(now, source.tz);
	const nextAt = quietHourBoundary(now, options.quietHours);
	for (const item of source.items()) {
		if (!activeItem(item)) continue;
		const row = { itemId: item.id, status: 'active', nextAt, createdAt: now, pings: 0 } as const;
		if (flagged(item))
			reminders.push({
				...row,
				key: `flag|${item.id}|${item.clocks.needs_daniel ?? ''}`,
				kind: 'flag'
			} as const);
		const due = item.every ? null : dueTime(item.due, source.tz);
		if (due !== null && localDay(due, source.tz) <= today)
			reminders.push({
				...row,
				key: `due|${item.id}|${item.clocks.due ?? ''}`,
				kind: 'due'
			} as const);
	}
	// Legacy inserts the flag rows first, then today's outstanding due rows.
	return reminders.sort((a, b) => Number(a.kind === 'due') - Number(b.kind === 'due'));
}

export function scanDirectReminders(
	state: TrackerNotificationState,
	options: TrackerNotificationOptions,
	now: number
): void {
	if (!options.chiefOfStaff) return;
	const active = new Set<string>();
	for (const row of reminderRows(options, now)) {
		active.add(row.key);
		if (!state.reminders.has(row.key)) state.reminders.set(row.key, row);
	}
	for (const row of state.reminders.values()) {
		if (row.status === 'active' && !active.has(row.key)) row.status = 'closed';
	}
}

function brief(row: ReminderRow, item: TrackerNotificationItem) {
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
		first_noticed_at: isoTime(row.createdAt)
	};
}

export function nextDirectReminder(
	state: TrackerNotificationState,
	options: TrackerNotificationOptions,
	destination: TrackerDestination,
	now: number
): DeliveryAttempt | undefined {
	const due = readyRows(state.reminders.values(), now, (row) => row.status === 'active');
	if (!due.length) return undefined;
	const release = quietHourBoundary(now, options.quietHours);
	if (release > now) {
		for (const row of due) row.nextAt = release;
		return undefined;
	}
	const fresh: ReturnType<typeof brief>[] = [];
	const repeat: ReturnType<typeof brief>[] = [];
	for (const row of due) {
		const item = options.source.item(row.itemId);
		if (!item) {
			row.status = 'closed';
			continue;
		}
		(row.pings === 0 ? fresh : repeat).push(brief(row, item));
	}
	const pending = due.filter((row) => row.status === 'active');
	if (!pending.length) return undefined;
	const id = eventId(pending.map((row) => `${row.key}|${row.pings}`));
	const request = callbackRequest(id, destination, {
		type: 'attention',
		new: fresh,
		reminders: repeat,
		digest: options.source.digest(now),
		node: options.source.node,
		sent_at: isoTime(now)
	});
	return { kind: 'reminders', keys: pending.map((row) => row.key), request, startedAt: now };
}
