// @harness-uid u_jmisdaw57x
import { z } from 'zod';
import { webPushContract } from '../../../utils/projects-sessions/webPushContract';
import { isWebPushEndpoint } from '../../../utils/projects-sessions/isWebPushEndpoint';
import type {
	WebPushMessage,
	PushSenderReport,
	PushSenderView,
	PushSubscriptionTarget
} from '../../../utils/projects-sessions/webPushContract.types';
import { encryptWebPush } from './encryptWebPush';
import { hubSenderAuthorization, vapidAuthorization } from './webPushTokens';
import { WebPushHubError } from './WebPushHubError';
import type { PushDelivery, WebPushConfig } from './webPush.types';
import type { PushPorts } from './webPushTransport.types';

const senderPath = '/api/push/sender';
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const senderView = z.object({
	quiet: z.object({ enabled: z.boolean(), start: clock, end: clock }),
	subscriptions: z
		.array(
			z.object({
				endpoint: z.string().refine(isWebPushEndpoint),
				keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) })
			})
		)
		.max(webPushContract.maxSubscriptions)
});

async function hubRequest(config: WebPushConfig, ports: PushPorts, init: RequestInit) {
	const response = await ports.fetch(config.hubOrigin + senderPath, {
		...init,
		headers: {
			authorization: hubSenderAuthorization(config, ports.now),
			'content-type': 'application/json'
		},
		redirect: 'error',
		signal: AbortSignal.timeout(15_000)
	});
	if (!response.ok) throw new WebPushHubError(response.status);
	return response.json();
}

export async function readSenderView(
	config: WebPushConfig,
	ports: PushPorts
): Promise<PushSenderView> {
	return senderView.parse(await hubRequest(config, ports, { method: 'GET' }));
}

export async function reportPushDelivery(
	config: WebPushConfig,
	ports: PushPorts,
	report: PushSenderReport
): Promise<void> {
	await hubRequest(config, ports, { method: 'POST', body: JSON.stringify(report) });
}

/** One message to one browser. An expired message is useless after the next repeat. */
export async function sendWebPush(
	config: WebPushConfig,
	ports: PushPorts,
	delivery: { target: PushSubscriptionTarget; message: WebPushMessage }
): Promise<PushDelivery> {
	const { target, message } = delivery;
	const approval = 'kind' in message;
	try {
		const body = encryptWebPush(Buffer.from(JSON.stringify(message)), target.keys);
		const response = await ports.fetch(target.endpoint, {
			method: 'POST',
			body: new Uint8Array(body),
			headers: {
				authorization: vapidAuthorization(config, target.endpoint, ports.now),
				'content-encoding': 'aes128gcm',
				'content-type': 'application/octet-stream',
				ttl: approval ? '300' : '900',
				topic: approval ? 'harness-device-approval' : 'harness-needs-you',
				urgency: 'high'
			},
			redirect: 'error',
			signal: AbortSignal.timeout(15_000)
		});
		await response.body?.cancel();
		if (response.status === 404 || response.status === 410) return 'gone';
		return response.ok ? 'delivered' : 'failed';
	} catch {
		return 'failed';
	}
}
