// @harness-uid u_vqnqshfas2
import type {
	TrackerDeliveryRequest,
	TrackerDestination,
	TrackerPayloadFields
} from '../TrackerNotificationService.types';

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
