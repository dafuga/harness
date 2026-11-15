// @harness-uid u_x7kddegtw2
import type { CheckRunService } from './check-run-service/CheckRunService';
import type { snapshotVideoInputs } from './snapshotVideoInputs';
export interface SnapshotVideoRun {
	runner: CheckRunService;
	failures: string[];
	videoInputs: Omit<Awaited<ReturnType<typeof snapshotVideoInputs>>, 'failures'>;
}
