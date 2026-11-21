// @harness-uid u_vqnqshfas2
import type {
	TrackerNotificationOptions,
	TrackerWebhookEnqueue
} from './TrackerNotificationService.types';

export type {
	TrackerNotificationOptions,
	TrackerWebhookEnqueue
} from './TrackerNotificationService.types';

export class TrackerNotificationService {
	constructor(_options: TrackerNotificationOptions) {}

	async tick(_itemIds?: readonly string[]): Promise<void> {}

	async pause(_by?: string): Promise<void> {}

	async resume(): Promise<void> {}

	enqueue(_entry: TrackerWebhookEnqueue): void {}
}
