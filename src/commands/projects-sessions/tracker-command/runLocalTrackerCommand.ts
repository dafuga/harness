// @harness-uid u_tli3kgnifh
import { runTrackerCoordination, isTrackerCoordinationCommand } from './runTrackerCoordination';
import type { TrackerNodeConfig } from '../../../services/projects-sessions/tracker-node-service/trackerNodeConfig.types';
import { isLocalBackupCommand, runLocalTrackerBackup } from './runLocalTrackerBackup';
import { runTrackerHostWork } from './runTrackerHostWork';
import { runLocalTrackerWebPush } from './runLocalTrackerWebPush';

/** Local administration and managed-run commands that own their request lifecycle. */
export function runLocalTrackerCommand(args: string[], config: TrackerNodeConfig) {
	if (isTrackerCoordinationCommand(args[0])) return runTrackerCoordination(args, config);
	if (isLocalBackupCommand(args)) return runLocalTrackerBackup(args.slice(1), config);
	if (args[0] === 'host-work') return runTrackerHostWork(args.slice(1), config);
	if (args[0] === 'web-push') return runLocalTrackerWebPush(args.slice(1), config);
	return undefined;
}
