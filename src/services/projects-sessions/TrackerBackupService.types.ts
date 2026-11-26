// @harness-uid u_sebrprn5si
import type { TrackerLocalApiService } from './TrackerLocalApiService';

export interface TrackerBackupOptions {
	/** Owned by the service: daily and weekly files here are rotated. */
	directory: string;
	/** Hourly copies another job keeps here are listed, never changed. */
	externalDirectory?: string;
	stateFile: string;
}

export interface TrackerBackupDependencies extends TrackerBackupOptions {
	items: TrackerLocalApiService;
	now: () => number;
	timeZone: string;
}

export type TrackerBackupResult =
	| { ok: true; file: string; size: number }
	| { ok: false; error: string };
