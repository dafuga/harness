// @harness-uid u_z4ttafmvjp
import { quietHourBoundary } from '../../helpers/attention-timing/quietHourBoundary';
import { danielQuietHours } from './tracker-notification-service/notificationRules';
import { cosSafetyMessage } from './tracker-native-runtime-service/trackerCosDeliveryAsk';
import type { TrackerCosSafetyNotice } from './tracker-native-runtime-service/trackerCosDelivery.types';
import { deliverNeedsYou } from './tracker-web-push-service/deliverNeedsYou';
import { emptyPushState, failedPush } from './tracker-web-push-service/planNeedsYouPush';
import type { PushState } from './tracker-web-push-service/webPush.types';
import type { WebPushConfig } from './tracker-web-push-service/webPush.types';
import { readSenderView } from './tracker-web-push-service/webPushTransport';
import type { TrackerWebPushOptions } from './TrackerWebPushService.types';

/** Sends the one notice that Chief of Staff isn't responding. It never carries an ask. */
export class TrackerSafetyPushService {
	private state: PushState = emptyPushState();
	private generation?: string;

	constructor(private readonly options: TrackerWebPushOptions) {}

	async send(config: WebPushConfig): Promise<void> {
		const notice = this.options.safety?.read();
		if (!notice || this.held(notice)) return;
		const { generation } = notice;
		if (generation !== this.generation) this.state = emptyPushState();
		this.generation = generation;
		if (!this.state.sent.includes(generation)) await this.deliver(config, notice);
		if (this.state.sent.includes(generation)) this.options.safety?.complete(generation);
	}

	/** Only the emergency notice is delivered during the night hold. */
	private held({ emergency }: TrackerCosSafetyNotice): boolean {
		const now = this.options.now();
		return !emergency && quietHourBoundary(now, danielQuietHours) > now;
	}

	private async deliver(config: WebPushConfig, notice: TrackerCosSafetyNotice): Promise<void> {
		const now = this.options.now();
		if ((this.state.holdUntil ?? 0) > now) return;
		const ports = { fetch: this.options.fetch ?? fetch, now };
		try {
			const view = await readSenderView(config, ports);
			this.state = await deliverNeedsYou(config, ports, {
				view,
				asks: [],
				keys: [notice.generation],
				state: this.state,
				message: cosSafetyMessage(notice)
			});
		} catch {
			this.state = failedPush(this.state, 'Safety notice delivery failed', now);
		}
	}
}
