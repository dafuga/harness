// @harness-uid u_k4lx7zia6b
import type { TrackerHostSupervisorOptions } from '../TrackerHostSupervisorService.types';
import { rotateTrackerLog } from '../tracker-health-service/rotateTrackerLog';
import { supervisorLog } from './appendingTrackerChild';

/** A failed rotation is logged and retried later; the service keeps being supervised. */
export function rotateSupervisedLog(options: TrackerHostSupervisorOptions): void {
	try {
		rotateTrackerLog(options.log, options.logLimit);
	} catch {
		supervisorLog(options.log, 'could not rotate the log');
	}
}
