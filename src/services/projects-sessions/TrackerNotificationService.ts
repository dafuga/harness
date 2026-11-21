// @harness-uid u_vqnqshfas2
import type {
	TrackerNotificationOptions,
	TrackerWebhookEnqueue
} from './TrackerNotificationService.types';
import { enqueueWebhook } from './tracker-notification-service/enqueueWebhook';
import { runNotificationTick } from './tracker-notification-service/notificationTick';

export type {
	TrackerDeliveryRequest,
	TrackerDeliveryResult,
	TrackerDestination,
	TrackerNotificationDestinations,
	TrackerNotificationItem,
	TrackerNotificationOp,
	TrackerNotificationOptions,
	TrackerNotificationQueue,
	TrackerNotificationSource,
	TrackerNotificationState,
	TrackerWebhookEnqueue,
	TrackerWebhookOptions
} from './TrackerNotificationService.types';

/** Runs Tracker's callback, webhook outbox, and reminder transitions against injected ports. */
export class TrackerNotificationService {
	constructor(private readonly options: TrackerNotificationOptions) {}

	/** Scan item changes and drain eligible work for this node. */
	tick(itemIds?: readonly string[]): Promise<void> {
		return this.options.queue.exclusive(() => runNotificationTick(this.options, itemIds));
	}

	/** Queue one hub recurring wake-up, dispatcher summary, or launch hold. */
	enqueue(entry: TrackerWebhookEnqueue): void {
		if (this.options.role === 'hub' && this.options.webhook)
			this.options.queue.update((state) => enqueueWebhook(state, entry, this.options));
	}

	/** Hold Chief of Staff webhooks while continuing to deliver routed events. */
	pause(by?: string): Promise<void> {
		return this.options.queue.exclusive(async () => {
			if (this.options.role !== 'hub' || !this.options.webhook) return;
			this.options.queue.update((state) => {
				state.paused ??= { at: this.options.now(), by: by?.length ? by : null };
			});
		});
	}

	/** Reset pending retries and send one catch-up batch for the still-relevant lines. */
	resume(): Promise<void> {
		return this.options.queue.exclusive(async () => {
			const { now, queue, role, webhook } = this.options;
			if (role !== 'hub' || !webhook) return;
			queue.update((state) => {
				delete state.paused;
				if (webhook.batch !== false) state.forceAttention = true;
				const at = now();
				for (const row of state.outbox.values()) {
					if (row.status !== 'pending') continue;
					row.nextAt = at;
					row.attempts = 0;
				}
			});
			await runNotificationTick(this.options);
		});
	}
}
