// @harness-uid u_vqnqshfas2
import type {
	TrackerDeliveryRequest,
	TrackerDestination,
	TrackerPayloadFields
} from '../TrackerNotificationService.types';

import type { DirectReminderBrief } from './notificationState.types';
import { isoTime } from './notificationRules';

export function flagWebhook(
	destination: TrackerDestination,
	id: string,
	briefs: DirectReminderBrief[],
	{ node, now }: { node: string; now: number }
) {
	const at = isoTime(now);
	const items = briefs.map((item) => ({
		...item,
		item_id: item.id,
		event: 'needs_daniel',
		escalation: item.reminder_number,
		at
	}));
	const text = items
		.map(
			(item) =>
				`NEEDS DANIEL [${item.id.slice(0, 6)}]: ${item.title} - waiting ${item.waiting_minutes}m`
		)
		.join('\n');
	return webhookRequest(destination, {
		event_id: id,
		event: 'attention',
		to: 'chief_of_staff',
		batch: true,
		count: items.length,
		counts: { needs_daniel: items.length },
		items,
		text,
		node,
		sent_at: at
	});
}

export function webhookRequest(
	destination: TrackerDestination,
	payload: TrackerPayloadFields & { event_id: string; event: string }
): TrackerDeliveryRequest {
	return {
		id: payload.event_id,
		destination,
		body: JSON.stringify(payload),
		headers: {
			'content-type': 'application/json',
			'user-agent': 'tracker',
			'x-tracker-event': payload.event,
			'x-tracker-event-id': payload.event_id
		}
	};
}

export function callbackRequest(
	id: string,
	destination: TrackerDestination,
	payload: TrackerPayloadFields & { type: string },
	commandEvent?: { id: string; events: readonly string[] }
): TrackerDeliveryRequest {
	const body = JSON.stringify(payload);
	if (destination.kind === 'http')
		return {
			id,
			destination,
			body,
			headers: {
				'content-type': 'application/json',
				'user-agent': 'tracker',
				'x-tracker-event': payload.type
			}
		};
	return {
		id,
		destination,
		body,
		environment: {
			TRACKER_EVENT: commandEvent?.events.join(',') ?? payload.type,
			TRACKER_ITEM_ID: commandEvent?.id ?? '',
			TRACKER_PAYLOAD: body
		}
	};
}
