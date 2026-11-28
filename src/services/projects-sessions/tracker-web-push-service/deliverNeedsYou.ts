// @harness-uid u_5x35b7bzsf
import { deliveredPush, failedPush, unheardPush } from './planNeedsYouPush';
import { needsYouPushMessage } from './needsYouPushMessage';
import { reportPushDelivery, sendWebPush } from './webPushTransport';
import type { PushDeliveryAttempt } from './deliverNeedsYou.types';
import type { PushPorts } from './webPushTransport.types';
import type { PushState, WebPushConfig } from './webPush.types';

/** Sends the one summary to every subscribed browser and returns what to remember. */
export async function deliverNeedsYou(
	config: WebPushConfig,
	ports: PushPorts,
	attempt: PushDeliveryAttempt
): Promise<PushState> {
	const { view, asks, keys, state } = attempt;
	const message = attempt.message ?? needsYouPushMessage(asks);
	const results = await Promise.all(
		view.subscriptions.map(async (target) => ({
			endpoint: target.endpoint,
			result: await sendWebPush(config, ports, { target, message })
		}))
	);
	const endpoints = (wanted: string) =>
		results.filter(({ result }) => result === wanted).map(({ endpoint }) => endpoint);
	const delivered = endpoints('delivered');
	const gone = endpoints('gone');
	// The report only tidies the Hub's list, so losing it never sends the message again.
	if (delivered.length || gone.length)
		await reportPushDelivery(config, ports, { delivered, gone }).catch(() => {});
	if (delivered.length) return deliveredPush(keys, ports.now);
	if (endpoints('failed').length)
		return failedPush(state, 'No push service accepted the message', ports.now);
	return unheardPush(state, ports.now);
}
