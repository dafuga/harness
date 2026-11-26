// @harness-uid u_qfjuozdzjy
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import { TrackerBackupService } from '../TrackerBackupService';
import type { TrackerBackupRuntime, TrackerBackups } from './composeTrackerBackups.types';

/** The listing folder always exists; only a hub with backup settings also takes backups. */
export function composeTrackerBackups(
	runtime: TrackerBackupRuntime,
	options: TrackerNativeRuntimeOptions
): TrackerBackups {
	const { backup, backupDirectory, role, timeZone = 'Europe/Lisbon' } = options;
	if (!backup || role !== 'hub') return { directory: backupDirectory };
	const { store, items, now } = runtime;
	const service = new TrackerBackupService(store.database, { ...backup, items, now, timeZone });
	return { ...backup, service };
}
