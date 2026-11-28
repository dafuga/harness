// @harness-uid u_z4ttafmvjp
import { isDeepStrictEqual } from 'node:util';
import { quietHourBoundary } from '../../helpers/attention-timing/quietHourBoundary';
import { danielQuietHours } from './tracker-notification-service/notificationRules';
import { cosSafetyMessage } from './tracker-native-runtime-service/trackerCosDeliveryAsk';
import { deliverNeedsYou } from './tracker-web-push-service/deliverNeedsYou';
import {
	emptyPushState,
	failedPush,
	planNeedsYouPush,
	pushAskKey,
	quietPushHold
} from './tracker-web-push-service/planNeedsYouPush';
import {
	readPushState,
	readWebPushConfig,
	webPushPaths,
	writePrivateJsonFile
} from './tracker-web-push-service/webPushFiles';
import { readSenderView } from './tracker-web-push-service/webPushTransport';
import type { PushAttempt } from './tracker-web-push-service/deliverNeedsYou.types';
import type { PushState, WebPushConfig } from './tracker-web-push-service/webPush.types';
import type { TrackerWebPushOptions } from './TrackerWebPushService.types';

/**
 * Browser notifications for Daniel's open decisions, sent by the Tracker hub node: one summary
 * when a decision appears, again every 15 minutes while any is open, never in quiet hours.
 */
export class TrackerWebPushService {
	/** Kept here too: a state file that cannot be written must never make a send repeat early. */
	private remembered?: PushState;
	private safetyState = emptyPushState();
	private safetyGeneration?: string;

	constructor(private readonly options: TrackerWebPushOptions) {}

	/** Does nothing until `tracker web-push setup` has run; the Hub is asked only when due. */
	async tick(): Promise<void> {
		const paths = webPushPaths(this.options.database);
		const config = readWebPushConfig(paths.config);
		if (!config) return;
		await this.sendSafetyNotice(config);
		const now = this.options.now();
		if (quietHourBoundary(now, danielQuietHours) > now) return;
		const asks = this.options.asks();
		const keys = asks.map(pushAskKey);
		const stored = this.remembered ?? readPushState(paths.state);
		const { state, due } = planNeedsYouPush(keys, stored, this.options.now());
		const next = due ? await this.attempt(config, { asks, keys, state }) : state;
		this.remembered = next;
		if (!isDeepStrictEqual(next, readPushState(paths.state)))
			writePrivateJsonFile(paths.state, next);
	}

	private async sendSafetyNotice(config: WebPushConfig): Promise<void> {
		const { safety, now } = this.options;
		const notice = safety?.read();
		if (!notice || (!notice.emergency && quietHourBoundary(now(), danielQuietHours) > now()))
			return;
		const { generation } = notice;
		if (generation !== this.safetyGeneration) this.safetyState = emptyPushState();
		this.safetyGeneration = generation;
		if (!this.safetyState.sent.includes(generation)) {
			if ((this.safetyState.holdUntil ?? 0) > now()) return;
			const ports = { fetch: this.options.fetch ?? fetch, now: now() };
			try {
				const view = await readSenderView(config, ports);
				this.safetyState = await deliverNeedsYou(config, ports, {
					view,
					asks: [],
					keys: [generation],
					state: this.safetyState,
					message: cosSafetyMessage(notice)
				});
			} catch {
				this.safetyState = failedPush(this.safetyState, 'Safety notice delivery failed', now());
			}
		}
		if (this.safetyState.sent.includes(generation)) safety?.complete(generation);
	}

	private async attempt(config: WebPushConfig, attempt: PushAttempt): Promise<PushState> {
		const now = this.options.now();
		const ports = { fetch: this.options.fetch ?? fetch, now };
		try {
			const view = await readSenderView(config, ports);
			const held = quietPushHold(attempt.state, view.quiet, now);
			if (held) return held;
			return await deliverNeedsYou(config, ports, { ...attempt, view });
		} catch (error) {
			const reason = error instanceof Error ? error.message : 'send failed';
			return failedPush(attempt.state, reason.slice(0, 200), now);
		}
	}
}
