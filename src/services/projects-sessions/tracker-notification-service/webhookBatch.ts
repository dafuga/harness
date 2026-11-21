// @harness-uid u_vqnqshfas2
import type { TrackerDestination } from '../TrackerNotificationService.types';
import type { DeliveryAttempt, OutboxRow, WebhookPayload } from './notificationState.types';
import { webhookRequest } from './deliveryRequest';
import { eventId, isoTime } from './notificationRules';

function eventOrder(payload: WebhookPayload): number {
	if (payload.event === 'blocked') return 0;
	if (payload.event !== 'needs_daniel') return 3;
	return payload.escalation === 0 ? 1 : 2;
}

function recurringWake(payload: WebhookPayload) {
	return {
		event: 'recurring_due',
		event_id: payload.event_id,
		item_id: payload.item_id,
		agent: payload.agent,
		owner: payload.owner,
		title: payload.title,
		notes: payload.notes ?? null,
		occurrence: payload.occurrence,
		occurrence_local: payload.occurrence_local,
		every: payload.every,
		every_tz: payload.every_tz,
		next_due: payload.next_due,
		...(payload.missed ? { missed: payload.missed } : {}),
		...(payload.box_job ? { box_job: payload.box_job, finding: payload.finding ?? null } : {})
	};
}

function batchCounts(items: WebhookPayload[], wakes: number, route: string | null) {
	const count = (event: string) => items.filter((item) => item.event === event).length;
	return {
		blocked: count('blocked'),
		needs_daniel_new: items.filter((item) => item.event === 'needs_daniel' && item.escalation === 0)
			.length,
		reminders: items.filter((item) => item.event === 'needs_daniel' && item.escalation > 0).length,
		due: count('due'),
		recurring_due: wakes,
		...(route === null
			? {}
			: {
					done: count('done'),
					resolved: count('resolved'),
					changed: count('changed'),
					blocked_no_daniel: items.filter((item) => item.event === 'blocked' && !item.needs_daniel)
						.length
				})
	};
}

export function outboxBatch(
	rows: OutboxRow[],
	destination: TrackerDestination,
	route: string | null,
	context: { node: string; now: number }
): DeliveryAttempt {
	const { node, now } = context;
	const payloads = rows.map((row) => row.payload);
	const items = payloads
		.filter((payload) => payload.event !== 'recurring_due')
		.sort((a, b) => eventOrder(a) - eventOrder(b));
	const recurring = payloads
		.filter((payload) => payload.event === 'recurring_due')
		.sort((a, b) => String(a.occurrence).localeCompare(String(b.occurrence)))
		.map(recurringWake);
	const keys = rows.map((row) => row.key);
	const request = webhookRequest(destination, {
		event_id: eventId(keys),
		event: 'attention',
		to: route ?? 'chief_of_staff',
		count: items.length,
		counts: batchCounts(items, recurring.length, route),
		items,
		recurring_due: recurring,
		node,
		sent_at: isoTime(now),
		attempt: rows.reduce((highest, row) => Math.max(highest, row.attempts), 0) + 1
	});
	return { kind: 'outbox', keys, request, startedAt: now };
}

export function outboxSingle(
	row: OutboxRow,
	destination: TrackerDestination,
	now: number
): DeliveryAttempt {
	const request = webhookRequest(destination, {
		...row.payload,
		attempt: row.attempts + 1,
		sent_at: isoTime(now)
	});
	return { kind: 'outbox', keys: [row.key], request, startedAt: now };
}
