// @harness-uid u_i2fsipusrr
import { TrackerHealthHttpError } from './TrackerHealthHttpError';
import { dirname, join } from 'node:path';
import { isQuietHour } from '../../../helpers/attention-timing/isQuietHour';
import { readPrivateText } from '../tracker-node-service/trackerNodeConfig';
import { danielQuietHours } from '../tracker-notification-service/notificationRules';
import type { TrackerHealthReport } from '../TrackerHealthService.types';
import type { TrackerHealthAlertTarget } from './trackerHealthAlert.types';
import { trackerHealthDue } from './trackerHealthDue';
import type { TrackerHealthState } from './trackerHealthState.types';

/** The separate channel for when the Tracker or its webhook cannot carry the alert. */
export async function sendTrackerHealthFallback(
	target: TrackerHealthAlertTarget,
	report: TrackerHealthReport,
	state: TrackerHealthState,
	apiUp: boolean
): Promise<void> {
	const due = trackerHealthDue(report.failing, state, 'last_fallback', target.now);
	// A dead service is urgent; anything else waits for the morning run.
	if (!due.length || (apiUp && isQuietHour(target.now, danielQuietHours))) return;
	const destination = fallbackDestination(dirname(target.configPath));
	if (!destination) {
		report.alertProblems.push('no usable fallback alert channel (health-fallback.url and .key)');
		return;
	}
	const failing = due.map(({ name, detail }) => ({ name, detail }));
	const body = {
		event: 'tracker_health',
		to: 'chief_of_staff',
		node: report.node,
		at: report.at,
		failing
	};
	try {
		const response = await target.post(destination.url, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'user-agent': 'tracker-health',
				authorization: `Bearer ${destination.key}`
			},
			body: JSON.stringify(body),
			redirect: 'error',
			signal: AbortSignal.timeout(15_000)
		});
		if (!response.ok) throw new TrackerHealthHttpError(`HTTP ${response.status}`);
		for (const { name } of due) state.checks[name].last_fallback = target.now;
	} catch {
		report.alertProblems.push('the fallback alert channel did not accept the alert');
	}
}

function fallbackDestination(directory: string): { url: string; key: string } | null {
	try {
		const url = new URL(readPrivateText(join(directory, 'health-fallback.url')).trim());
		const key = readPrivateText(join(directory, 'health-fallback.key')).trim();
		const secure =
			url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === '127.0.0.1');
		return secure && key ? { url: url.href, key } : null;
	} catch {
		return null;
	}
}
