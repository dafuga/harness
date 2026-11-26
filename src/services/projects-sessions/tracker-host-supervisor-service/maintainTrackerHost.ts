// @harness-uid u_w5ihdujq42
import { setTimeout as delay } from 'node:timers/promises';
import type { TrackerHostSupervisorOptions } from '../TrackerHostSupervisorService.types';
import { rotateSupervisedLog } from './rotateSupervisedLog';
import { appendingTrackerChild, supervisorLog } from './appendingTrackerChild';
import { nextTrackerHealthAt } from './nextTrackerHealthAt';

const healthLimit = 120_000;

/** Rotate the log every minute and run the health check on schedule, even while the service is down. */
export async function maintainTrackerHost(
	options: TrackerHostSupervisorOptions,
	signal: AbortSignal
): Promise<void> {
	const { log, health, maintenanceMs = 60_000 } = options;
	const nextAt = options.nextHealthAt ?? nextTrackerHealthAt;
	let due = nextAt(Date.now(), true);
	while (!signal.aborted) {
		const wait = Math.max(1, Math.min(maintenanceMs, due - Date.now()));
		await delay(wait, undefined, { signal }).catch(() => {});
		if (signal.aborted) return;
		rotateSupervisedLog(options);
		if (Date.now() < due) continue;
		const bounded = AbortSignal.any([signal, AbortSignal.timeout(healthLimit)]);
		const outcome = await appendingTrackerChild(health, log, bounded);
		supervisorLog(log, `health check finished (${outcome})`);
		due = nextAt(Date.now(), false);
	}
}
