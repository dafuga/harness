import { TrackerBackupService } from '../TrackerBackupService';
import type { TrackerNativeRuntimeService } from '../TrackerNativeRuntimeService';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';

export function composeTrackerBackups(
	{ store, items, now }: Pick<TrackerNativeRuntimeService, 'store' | 'items' | 'now'>,
	{ backup, role, timeZone = 'Europe/Lisbon' }: TrackerNativeRuntimeOptions
) {
	if (!backup || role !== 'hub') return undefined;
	const service = new TrackerBackupService(store.database, { ...backup, items, now, timeZone });
	return { ...backup, service };
}
