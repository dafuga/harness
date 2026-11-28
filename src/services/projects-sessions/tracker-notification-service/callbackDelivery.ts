// @harness-uid u_vqnqshfas2
import type {
	TrackerNotificationItem,
	TrackerNotificationSource
} from '../TrackerNotificationService.types';
import type {
	CallbackEvent,
	DeliveryAttempt,
	TrackerNotificationState
} from './notificationState.types';
import { callbackRequest } from './deliveryRequest';
import { clockTime, isoTime, minute, readyRows } from './notificationRules';

function completionEvents(item: TrackerNotificationItem): Map<string, CallbackEvent[]> {
	const events = new Map<string, CallbackEvent[]>();
	const { status, resolved } = item.clocks;
	if (item.status === 'done' && status) events.set(status, ['done']);
	if (item.resolved && resolved && !item.chief_answer)
		events.set(resolved, [...(events.get(resolved) ?? []), 'resolved']);
	return events;
}

function callbackTargets(item: TrackerNotificationItem, source: TrackerNotificationSource) {
	const targets = [];
	if (item.callback?.node === source.node) {
		const { id, kind, legacyTarget } = item.callback;
		targets.push({ targetId: 'item', destination: { id, kind }, since: 0, legacyTarget });
	}
	const agent = item.agent ? source.agent(item.agent) : undefined;
	if (agent)
		targets.push({
			targetId: `agent:${agent.name}`,
			destination: agent.target,
			since: agent.createdAt,
			legacyTarget: agent.legacyTarget
		});
	return targets;
}

function queueItemCallbacks(
	state: TrackerNotificationState,
	item: TrackerNotificationItem,
	source: TrackerNotificationSource,
	now: number
): void {
	const eventsByClock = completionEvents(item);
	if (!eventsByClock.size) return;
	const targets = callbackTargets(item, source);
	for (const [clock, events] of eventsByClock) {
		const at = clockTime(clock);
		if (at < source.createdAt - minute) continue;
		for (const { targetId, destination, since, legacyTarget } of targets) {
			const key = `${item.id}|${clock}|${targetId}`;
			if (at < since - minute || state.callbacks.has(key)) continue;
			state.callbacks.set(key, {
				key,
				itemId: item.id,
				targetId,
				destination,
				legacyTarget,
				events,
				status: 'pending',
				attempts: 0,
				nextAt: now,
				createdAt: now
			});
		}
	}
}

export function scanCallbacks(
	state: TrackerNotificationState,
	source: TrackerNotificationSource,
	now: number,
	itemIds?: readonly string[]
): void {
	const rows = itemIds ? itemIds.map((id) => source.item(id)) : source.items();
	for (const item of rows) {
		if (item?.title && !item.deleted && item.status !== 'ignored') {
			queueItemCallbacks(state, item, source, now);
		}
	}
}

export function nextCallback(
	state: TrackerNotificationState,
	source: TrackerNotificationSource,
	now: number
): DeliveryAttempt | undefined {
	const row = readyRows(
		state.callbacks.values(),
		now,
		(entry) => entry.status === 'pending' && Boolean(entry.destination)
	)[0];
	if (!row?.destination) return undefined;
	const payload = {
		type: 'item',
		events: row.events,
		item: source.publicItem(row.itemId),
		node: source.node,
		sent_at: isoTime(now)
	};
	const request = callbackRequest(row.key, row.destination, payload, {
		id: row.itemId,
		events: row.events
	});
	return { kind: 'callback', keys: [row.key], request, startedAt: now };
}
