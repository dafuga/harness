// @harness-uid u_vqnqshfas2
import type {
	TrackerNotificationOptions,
	TrackerWebhookEnqueue
} from '../TrackerNotificationService.types';
import type { TrackerNotificationState } from './notificationState.types';
import { launchWaitLine, queueLaunchWait } from './attentionTransitions';
import { enqueueEvent, itemEvent, summaryEvent } from './webhookEvents';

export function enqueueWebhook(
	state: TrackerNotificationState,
	entry: TrackerWebhookEnqueue,
	options: TrackerNotificationOptions
): void {
	const now = options.now();
	const { source, webhook } = options;
	if (entry.kind === 'autolaunch') {
		enqueueEvent(state, summaryEvent(entry.key, source, now, entry.payload), {
			key: entry.key,
			now
		});
		return;
	}
	const item = source.item(entry.itemId);
	if (!item) return;
	if (entry.kind === 'recurring_due') {
		const { key, at, payload } = entry;
		const event = itemEvent(item, entry.kind, { key, node: source.node, now }, { at, payload });
		enqueueEvent(state, event, { key, now });
		return;
	}
	const key = `launch_wait|${item.id}|${item.auto}`;
	const line = launchWaitLine(item, entry, now);
	if (webhook?.batch === false) {
		const event = summaryEvent(key, source, now, {
			title: 'Auto-launch request waiting',
			events: [line]
		});
		enqueueEvent(state, event, { key, now });
	} else queueLaunchWait(state, line, key, now);
}
