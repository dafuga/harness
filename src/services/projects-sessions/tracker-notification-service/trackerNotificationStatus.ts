// @harness-uid u_vqnqshfas2
import type { TrackerNotificationOptions } from '../TrackerNotificationService.types';
import type { OutboxRow } from './notificationState.types';

export function trackerNotificationStatus(options: TrackerNotificationOptions) {
	const { role, webhook, queue, destinations, now } = options;
	const chiefOfStaff =
		options.chiefOfStaff && destinations.available(options.chiefOfStaff)
			? ('configured' as const)
			: ('not configured' as const);
	if (role !== 'hub' || !webhook) {
		const note =
			role === 'hub' ? 'webhook sender is disabled' : 'only the hub sends webhook events';
		return { chiefOfStaff, webhook: { sender: false, note } };
	}
	return queue.update(({ outbox, flags, paused }) => {
		const { counts, lastSent, stuck } = outboxStatus(outbox.values(), now());
		const routes = Object.entries(webhook.routes ?? {}).map(([name, route]) => ({
			name,
			ready: destinations.available(route.destination)
		}));
		return {
			chiefOfStaff,
			webhook: {
				sender: true,
				configured: destinations.available(webhook.destination),
				outbox: counts,
				active_escalations: Array.from(flags.values()).filter(({ status }) => status === 'active')
					.length,
				paused: paused ?? false,
				last_sent_at: lastSent ? new Date(lastSent).toISOString() : null,
				stuck,
				routes,
				reminder_times: webhook.reminderTimes ?? null
			}
		};
	});
}

function outboxStatus(rows: Iterable<OutboxRow>, now: number) {
	const counts: Record<string, number> = {};
	let lastSent = 0;
	let stuck = 0;
	const cutoff = now - 3600_000;
	for (const row of rows) {
		counts[row.status] = (counts[row.status] ?? 0) + 1;
		lastSent = Math.max(lastSent, row.sentAt ?? 0);
		if (row.status === 'pending' && row.attempts >= 3 && row.createdAt < cutoff) stuck++;
	}
	return { counts, lastSent, stuck };
}
