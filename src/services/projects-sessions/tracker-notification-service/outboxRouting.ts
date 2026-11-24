// @harness-uid u_vqnqshfas2
import { quietHourBoundary } from '../../../helpers/attention-timing/quietHourBoundary';
import type {
	TrackerDestination,
	TrackerNotificationItem,
	TrackerNotificationOptions
} from '../TrackerNotificationService.types';
import type {
	DeliveryAttempt,
	OutboxRow,
	TrackerNotificationState
} from './notificationState.types';
import type { OutboxGroup, OutboxRecipient } from './outboxRouting.types';
import { flagged, holdRegularReminder, readyRows } from './notificationRules';
import { outboxBatch, outboxSingle } from './webhookBatch';
import { normalizeActor } from './webhookEvents';

const unroutedDrop = ['done', 'resolved', 'changed', 'blocked'];

function routeFor(
	row: OutboxRow,
	options: TrackerNotificationOptions
): OutboxRecipient | undefined {
	const routes = options.webhook?.routes ?? {};
	const names = [normalizeActor(row.payload.owner), normalizeActor(row.payload.agent)].filter(
		Boolean
	);
	const matched = Object.entries(routes).find(([name, route]) =>
		[name, ...(route.aliases ?? [])].some((alias) => names.includes(normalizeActor(alias)))
	);
	if (matched && options.destinations.available(matched[1].destination))
		return { route: matched[0], destination: matched[1].destination };
	return undefined;
}

function chiefOnly(row: OutboxRow): boolean {
	return (
		!row.itemId ||
		row.kind === 'needs_daniel' ||
		(row.kind === 'blocked' && row.payload.needs_daniel)
	);
}

function recipient(
	row: OutboxRow,
	options: TrackerNotificationOptions,
	chief: TrackerDestination
): OutboxRecipient | undefined {
	const fallback = { route: null, destination: chief };
	if (chiefOnly(row)) return fallback;
	const route = routeFor(row, options);
	if (route) return route;
	const rule =
		options.webhook?.unrouted?.[row.kind] ?? (unroutedDrop.includes(row.kind) ? 'drop' : 'cos');
	return rule === 'cos' ? fallback : undefined;
}

export function quietOutboxEvent(row: OutboxRow): boolean {
	return (
		row.kind === 'needs_daniel' ||
		row.kind === 'due' ||
		(row.kind === 'blocked' && row.payload.needs_daniel)
	);
}

function relevant(row: OutboxRow, item: TrackerNotificationItem | undefined): boolean {
	if (!item || item.deleted) return false;
	if (row.kind === 'needs_daniel') return flagged(item);
	if (row.kind === 'due') return item.status !== 'done' && item.due === row.payload.due;
	return item.status === 'blocked';
}

function drop(row: OutboxRow, reason: string): undefined {
	row.status = 'dropped';
	row.lastError = reason;
}

function currentOccurrence(row: OutboxRow, item: TrackerNotificationItem | undefined): boolean {
	return !!item && !item.deleted && !!item.every && item.occurrence === row.payload.occurrence;
}

function sendReady(
	row: OutboxRow,
	item: TrackerNotificationItem | undefined,
	options: TrackerNotificationOptions,
	now: number
): boolean {
	if (row.kind === 'recurring_due') {
		if (!currentOccurrence(row, item)) drop(row, 'superseded');
		return row.status !== 'dropped';
	}
	const remindAt = Date.parse(item?.remind_at ?? '');
	if (row.kind === 'needs_daniel' || row.kind === 'blocked') {
		if (remindAt > Date.parse(row.payload.occurred_at as string)) {
			drop(row, 'item reminder supersedes attention');
			return false;
		}
	}
	if (row.kind === 'due' && item && holdRegularReminder(item, now, options.reminderIntervalMinutes))
		return false;
	if (!quietOutboxEvent(row)) return true;
	if (!relevant(row, item)) {
		drop(row, 'no longer relevant');
		return false;
	}
	const release = quietHourBoundary(now, options.quietHours);
	if (release > now) row.nextAt = release;
	return release <= now;
}

function eligible(
	row: OutboxRow,
	options: TrackerNotificationOptions,
	context: { chief: TrackerDestination; paused: boolean; now: number }
): OutboxRecipient | undefined {
	const live = row.itemId ? options.source.item(row.itemId) : undefined;
	if (live?.status === 'ignored') return drop(row, 'item ignored');
	const target = recipient(row, options, context.chief);
	if (!target) return drop(row, 'no route');
	if (target.route === null) {
		if (options.webhook?.batch !== false) return drop(row, 'chief of staff gets the batch only');
		if (context.paused) return undefined;
	}
	return sendReady(row, live, options, context.now) ? target : undefined;
}

function supersedes(row: OutboxRow, previous: OutboxRow): boolean {
	return row.kind === 'needs_daniel'
		? row.payload.escalation >= previous.payload.escalation
		: row.createdAt >= previous.createdAt;
}

function collapse(rows: OutboxRow[]): OutboxRow[] {
	const newest = new Map<string, OutboxRow>();
	const keep = [];
	for (const row of rows) {
		if (row.kind !== 'needs_daniel' && row.kind !== 'changed') {
			keep.push(row);
			continue;
		}
		const key = `${row.kind}|${row.itemId}`;
		const previous = newest.get(key);
		if (!previous || supersedes(row, previous)) {
			if (previous) drop(previous, 'collapsed');
			newest.set(key, row);
		} else drop(row, 'collapsed');
	}
	return [...keep, ...newest.values()];
}

export function nextOutbox(
	state: TrackerNotificationState,
	options: TrackerNotificationOptions,
	chief: TrackerDestination,
	now: number
): DeliveryAttempt | undefined {
	const pending = readyRows(state.outbox.values(), now, (row) => row.status === 'pending');
	const groups = new Map<string | null, OutboxGroup>();
	const singles = [];
	for (const row of pending) {
		const target = eligible(row, options, { chief, paused: !!state.paused, now });
		if (!target) continue;
		if (
			!row.itemId ||
			(target.route === null && row.kind !== 'recurring_due' && !quietOutboxEvent(row))
		) {
			singles.push(row);
		} else {
			const group = groups.get(target.route) ?? { ...target, rows: [] };
			group.rows.push(row);
			groups.set(target.route, group);
		}
	}
	const first = groups.values().next().value;
	if (first)
		return outboxBatch(collapse(first.rows), first.destination, first.route, {
			node: options.source.node,
			now
		});
	return singles[0] ? outboxSingle(singles[0], chief, now) : undefined;
}
