// @harness-uid u_bl6xl2h4a3
import { urgentQueueAlertKind } from './trackerHostWatchdogAlerts';

/** Messages that monitors and sessions sent about something broken. */
const messageKinds: ReadonlySet<string> = new Set(['alert', 'flag-refused', 'cos-message']);

/** @pure Outage and security alerts: sent first, and raised sooner when they cannot be sent. */
export function isOutageAlert(kind: string): boolean {
	return (
		kind === urgentQueueAlertKind ||
		messageKinds.has(kind) ||
		kind.startsWith('credential exposure')
	);
}
