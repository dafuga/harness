// @harness-uid u_bl6xl2h4a3
import { urgentQueueAlertKind } from './trackerHostWatchdogAlerts';

import { trackerCosInboxKinds } from './trackerCosInbox';

/** @pure Outage and security alerts: sent first, and raised sooner when they cannot be sent. */
export function isOutageAlert(kind: string): boolean {
	return (
		kind === urgentQueueAlertKind ||
		trackerCosInboxKinds.has(kind) ||
		kind.startsWith('credential exposure')
	);
}
