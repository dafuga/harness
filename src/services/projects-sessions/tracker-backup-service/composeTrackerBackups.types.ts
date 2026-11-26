// @harness-uid u_qfjuozdzjy
import type { TrackerBackupService } from '../TrackerBackupService';
import type { TrackerLocalApiService } from '../TrackerLocalApiService';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';

export interface TrackerBackupRuntime {
	store: TrackerPersistenceService;
	items: TrackerLocalApiService;
	now: () => number;
}

export interface TrackerBackups {
	directory?: string;
	externalDirectory?: string;
	service?: TrackerBackupService;
}
