// @harness-uid u_bl6xl2h4a3
import { TrackerTmuxAdapter } from '../../../adapters/projects-sessions/TrackerTmuxAdapter';
import type {
	TrackerNativeNotificationOptions,
	TrackerNativeRuntimeOptions
} from '../TrackerNativeRuntimeService.types';
import type { TrackerDeliveryRequest } from '../TrackerNotificationService.types';
import { trackerWatchdogPort } from './trackerWatchdogPort';

const hostDestination = { kind: 'command', id: 'tracker-scheduled-reminder' } as const;

export function configuredTrackerReminderHost(
	options: TrackerNativeRuntimeOptions
): TrackerNativeNotificationOptions | undefined {
	const { node, role, hostEffects, hostEffectsHeld, notification } = options;
	const watchdog = hostEffects?.watchdog;
	if (role !== 'hub' || node !== 'daniel-primary-mbp' || hostEffectsHeld || !watchdog?.chiefOfStaff)
		return notification;
	const host =
		'tmux' in watchdog
			? tmuxReminder(new TrackerTmuxAdapter({ executable: watchdog.tmux, node }))
			: driverReminder(trackerWatchdogPort(watchdog, node), node);
	return {
		...notification,
		scheduledReminders: hostDestination,
		scheduledOnly: !notification,
		destinations: {
			available: (target) =>
				(target.kind === hostDestination.kind && target.id === hostDestination.id) ||
				(notification?.destinations.available(target) ?? false),
			async send(request) {
				if (
					request.destination.kind !== hostDestination.kind ||
					request.destination.id !== hostDestination.id
				) {
					if (notification) return notification.destinations.send(request);
					return { status: 'rejected', error: 'Tracker destination unavailable' };
				}
				const sent = await host(request, AbortSignal.timeout(15_000));
				return sent
					? { status: 'sent' }
					: { status: 'rejected', error: 'Chief of Staff is unavailable' };
			}
		}
	};
}

function reminderDetails(request: TrackerDeliveryRequest) {
	const {
		new: [reminder]
	} = JSON.parse(request.body);
	const id = String(reminder.id);
	const at = String(reminder.remind_at);
	if (!/^[a-z0-9-]{1,80}$/.test(id) || !/^\d{4}-[\d:TZ.-]+$/.test(at))
		throw new TypeError('Invalid Tracker reminder identity');
	return {
		id,
		at,
		message: `Scheduled Tracker reminder [${id.slice(0, 6)}] due at ${at}. Open Tracker item ${id} and remind Daniel as requested. Reminder reference ${request.id}.`
	};
}

function tmuxReminder(tmux: TrackerTmuxAdapter) {
	return async (request: TrackerDeliveryRequest, signal: AbortSignal) => {
		const { message } = reminderDetails(request);
		const panes = await tmux.scan(signal, /^cos$/);
		return panes.length === 1 && tmux.nudge({ pane: panes[0], cli: 'claude', message }, signal);
	};
}

function driverReminder(driver: ReturnType<typeof trackerWatchdogPort>, node: string) {
	return (request: TrackerDeliveryRequest, signal: AbortSignal) => {
		const { id, at, message } = reminderDetails(request);
		return driver.send(
			[
				{
					id: request.id,
					item_id: id,
					kind: 'remind_at',
					host: node,
					reason: message,
					identity: request.id,
					at: Date.parse(at)
				}
			],
			signal
		);
	};
}
