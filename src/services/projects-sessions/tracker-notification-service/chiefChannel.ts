// @harness-uid u_vqnqshfas2
import type {
	TrackerChiefChannel,
	TrackerChiefMessage,
	TrackerNotificationOptions
} from '../TrackerNotificationService.types';
import { webhookRequest } from './deliveryRequest';
import { isoTime } from './notificationRules';

/**
 * Chief of Staff's channel on the hub: the destination the digest and needs-Daniel alerts use,
 * or the Chief of Staff callback. Undefined when neither is configured and available here.
 */
export function trackerChiefChannel(
	options: TrackerNotificationOptions
): TrackerChiefChannel | undefined {
	const { role, webhook, chiefOfStaff, destinations, queue, source, now } = options;
	if (role !== 'hub') return undefined;
	const destination = [webhook?.destination, chiefOfStaff].find(
		(candidate) => candidate && destinations.available(candidate)
	);
	if (!destination) return undefined;
	return {
		send: (message: TrackerChiefMessage) => {
			const request = webhookRequest(destination, {
				event_id: `hub_message|${message.id}`,
				event: 'hub_message',
				to: 'chief_of_staff',
				message_id: message.id,
				item_id: message.itemId,
				text: message.text,
				node: source.node,
				sent_at: isoTime(now())
			});
			// One delivery at a time per destination: never typed over a digest being sent.
			return queue.exclusive(async () => ({
				attempt: request.id,
				result: await destinations.send(request)
			}));
		}
	};
}
