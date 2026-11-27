// @harness-uid u_vg7qhfaumu
import type { HubPushDevice, PushQuietHours } from '../../lib/networking-security/hubPush.types';
import {
	runDay,
	runTime
} from '../../../../reports/src/components/projects-sessions/hub-home/hubHomeTime';

export const deviceHints: Record<Exclude<HubPushDevice, 'on'>, string> = {
	off: 'Hear about new decisions, even with this tab closed.',
	blocked: 'Notifications are blocked. Allow them in this site’s browser settings, then reload.',
	install: 'To get notifications here, add Harness to your Home Screen and open it from there.',
	unsupported: 'This browser cannot show notifications.'
};

/** @pure The one quiet line shown once notifications are on. */
export function onSummary(quiet: PushQuietHours): string {
	const { enabled, start, end } = quiet;
	return enabled && start !== end
		? `Notifications on · quiet ${start}–${end} Lisbon`
		: 'Notifications on · no quiet hours';
}

/** @pure What this browser has actually received; "none yet" is never shown as a failure. */
export function lastDelivery(deliveredAt: number | null, now: number): string {
	if (!deliveredAt) return 'No decision notification has reached this browser yet.';
	const at = new Date(deliveredAt).toISOString();
	return `Last sent to this browser: ${runDay(at, now)} ${runTime(at)} Lisbon.`;
}
