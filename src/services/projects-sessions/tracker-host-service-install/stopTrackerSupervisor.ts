// @harness-uid u_fgw6zfrlhw
import { readFileSync } from 'node:fs';
import { tryAcquireTrackerSqliteLease } from '../../../adapters/projects-sessions/TrackerAdapterLeaseAdapter';
import { trackerSupervisorFiles } from '../tracker-host-supervisor-service/trackerSupervisorFiles';

/** Signal the recorded supervisor only while its lock proves the pid is still that supervisor. */
export function stopTrackerSupervisor(database: string): boolean {
	const { lockFile, pidFile } = trackerSupervisorFiles(database);
	const release = tryAcquireTrackerSqliteLease(lockFile);
	if (release) {
		release();
		return false;
	}
	const pid = Number(readFileSync(pidFile, 'utf8').trim());
	if (!Number.isSafeInteger(pid) || pid <= 1) return false;
	process.kill(pid, 'SIGTERM');
	return true;
}
