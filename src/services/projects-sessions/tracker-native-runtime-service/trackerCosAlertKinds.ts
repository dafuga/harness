// @harness-uid u_bl6xl2h4a3
import { urgentQueueAlertKind } from './trackerHostWatchdogAlerts';

import { trackerCosInboxKinds } from './trackerCosInbox';

export const staleDispatchHeartbeatKind = 'stale-dispatch-heartbeat';
export const cosOutageGrace = 30 * 60_000;

/** @pure Outage and security alerts: sent first, and raised sooner when they cannot be sent. */
export function isOutageAlert(kind: string): boolean {
	return (
		kind === urgentQueueAlertKind ||
		kind === staleDispatchHeartbeatKind ||
		trackerCosInboxKinds.has(kind) ||
		kind.startsWith('credential exposure')
	);
}
