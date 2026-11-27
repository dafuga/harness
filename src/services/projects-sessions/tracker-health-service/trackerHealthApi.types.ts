// @harness-uid u_lkwi7fkv3c
import type { TrackerHealthCheck, TrackerHealthStatus } from '../TrackerHealthService.types';

export interface TrackerHealthApiResult {
	check: TrackerHealthCheck;
	status?: TrackerHealthStatus;
}
