// @harness-uid u_kl47qqa2cz
import type { TrackerHealthReport } from '../TrackerHealthService.types';
import { raiseTrackerHealthItem, recoverTrackerHealthItem } from './trackerHealthItem';
import { sendTrackerHealthFallback } from './trackerHealthFallback';
import { trackerHealthDue } from './trackerHealthDue';
import type { TrackerHealthState } from './trackerHealthState.types';
import type { TrackerHealthAlertTarget } from './trackerHealthAlert.types';

/** Alert when a check starts failing and daily while it keeps failing; close on recovery. */
export async function alertTrackerHealth(
	target: TrackerHealthAlertTarget,
	report: TrackerHealthReport,
	state: TrackerHealthState
): Promise<void> {
	for (const { name, ok, severity } of report.checks)
		if (ok || severity === 'info') state.checks[name] = { ok: true };
		else state.checks[name] = { ...state.checks[name], ok: false };
	const apiUp = report.checks.some(({ name, ok }) => name === 'api' && ok);
	const tracked = apiUp && (await recordOnTracker(target, report, state));
	// A spoke without its hub, or a hub without its webhook, only queues what it records.
	const pathBroken =
		!tracked || report.failing.some(({ name }) => name === 'webhook' || name === 'hub_link');
	if (pathBroken) await sendTrackerHealthFallback(target, report, state, apiUp);
}

/** False when the Tracker could not carry this run's alert. */
async function recordOnTracker(
	target: TrackerHealthAlertTarget,
	report: TrackerHealthReport,
	state: TrackerHealthState
): Promise<boolean> {
	// The backup service raises its own ask, so this one never repeats it.
	const asked = report.failing.filter(({ name }) => name !== 'backup');
	const due = trackerHealthDue(asked, state, 'last_alert', target.now);
	try {
		if (due.length) {
			await raiseTrackerHealthItem(target.config, report, state);
			for (const { name } of due) state.checks[name].last_alert = target.now;
		} else if (!asked.length && state.item_open) {
			await recoverTrackerHealthItem(target.config, report, state);
		}
		return true;
	} catch {
		report.alertProblems.push('could not record the result on the Tracker');
		return false;
	}
}
