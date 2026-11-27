// @harness-uid u_o6zy42v37a
import type { TrackerHealthCheck } from '../TrackerHealthService.types';
import type { TrackerHealthState } from './trackerHealthState.types';

const repeatAfter = 24 * 3600_000;

/** Failures not yet sent on this channel, or sent a day or more ago. */
export function trackerHealthDue(
	failing: TrackerHealthCheck[],
	state: TrackerHealthState,
	sent: 'last_alert' | 'last_fallback',
	now: number
): TrackerHealthCheck[] {
	return failing.filter(({ name }) => {
		const last = state.checks[name]?.[sent];
		return last === undefined || now - last >= repeatAfter;
	});
}
