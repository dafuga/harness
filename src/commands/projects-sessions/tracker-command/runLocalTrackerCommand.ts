// @harness-uid u_tli3kgnifh
import type { TrackerNodeConfig } from '../../../services/projects-sessions/tracker-node-service/trackerNodeConfig.types';
import { isLocalBackupCommand, runLocalTrackerBackup } from './runLocalTrackerBackup';
import { runLocalTrackerWebPush } from './runLocalTrackerWebPush';

/** Commands that work on this computer's own files, without asking the running service. */
export function runLocalTrackerCommand(args: string[], config: TrackerNodeConfig) {
	if (isLocalBackupCommand(args)) return runLocalTrackerBackup(args.slice(1), config);
	if (args[0] === 'web-push') return runLocalTrackerWebPush(args.slice(1), config);
	return undefined;
}
