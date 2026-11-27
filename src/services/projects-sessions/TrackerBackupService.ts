// @harness-uid u_sebrprn5si
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import type { TrackerBackupDependencies, TrackerBackupResult } from './TrackerBackupService.types';
import { readTrackerBackupFiles } from './tracker-node-service/readTrackerBackupList';
import {
	clearTrackerBackupAlert,
	raiseTrackerBackupAlert
} from './tracker-backup-service/trackerBackupAlert';
import { trackerBackupClock } from './tracker-backup-service/trackerBackupClock';
import { trackerBackupFileError } from './tracker-backup-service/trackerBackupFileError';
import {
	readTrackerBackupState,
	writeTrackerBackupState
} from './tracker-backup-service/trackerBackupState';
import { writeTrackerBackup } from './tracker-backup-service/writeTrackerBackup';

const staleAfter = 36 * 3_600_000;

/** Takes the hub's daily verified snapshot and asks Daniel when backups fail or go stale. */
export class TrackerBackupService {
	private running?: Promise<TrackerBackupResult>;

	constructor(
		private readonly database: SqliteDatabase,
		private readonly options: TrackerBackupDependencies
	) {}

	async tick(): Promise<void> {
		const { stateFile, now } = this.options;
		const { date, time } = trackerBackupClock(now(), this.options.timeZone);
		const state = readTrackerBackupState(stateFile);
		if (!state.first_seen)
			writeTrackerBackupState(stateFile, { first_seen: new Date(now()).toISOString() });
		if (time >= '03:30' && state.last_scheduled_day !== date) {
			writeTrackerBackupState(stateFile, { last_scheduled_day: date });
			await this.take();
		}
		await this.checkStale();
	}

	take(): Promise<TrackerBackupResult> {
		this.running ??= this.runBackup().finally(() => (this.running = undefined));
		return this.running;
	}

	status() {
		const { directory, stateFile, timeZone } = this.options;
		const state = readTrackerBackupState(stateFile);
		const { last_ok, last_ok_file, last_ok_size, last_error, last_error_at, first_seen } = state;
		const file_error = trackerBackupFileError(directory, state);
		const files = readTrackerBackupFiles(directory);
		const count = (kind: string) => files.filter((file) => file.kind === kind).length;
		return {
			enabled: true,
			dir: directory,
			schedule: `daily 03:30 ${timeZone}; keep 14 daily + 8 weekly`,
			last_ok,
			last_ok_file,
			last_ok_size,
			last_error,
			last_error_at,
			file_error,
			stale: file_error !== null || this.isStale(last_ok ?? first_seen),
			counts: { daily: count('daily'), weekly: count('weekly'), bad: count('bad') }
		};
	}

	private isStale(since: string | null): boolean {
		return since !== null && this.options.now() - Date.parse(since) > staleAfter;
	}

	private async runBackup(): Promise<TrackerBackupResult> {
		const { directory, stateFile, items, now, timeZone } = this.options;
		const at = new Date(now()).toISOString();
		let written: { file: string; size: number };
		try {
			const { date } = trackerBackupClock(now(), timeZone);
			written = await writeTrackerBackup(this.database, directory, date);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			writeTrackerBackupState(stateFile, { last_error: message, last_error_at: at });
			await raiseTrackerBackupAlert(items, stateFile, `Tracker backup failed: ${message}`);
			return { ok: false, error: message };
		}
		writeTrackerBackupState(stateFile, {
			last_ok: at,
			last_ok_file: written.file,
			last_ok_size: written.size,
			last_error: null,
			last_error_at: null,
			stale_flagged_for: null
		});
		await clearTrackerBackupAlert(items, stateFile, `Backups are OK again: ${written.file}`);
		return { ok: true, ...written };
	}

	private async checkStale(): Promise<void> {
		const { directory, stateFile, items } = this.options;
		const state = readTrackerBackupState(stateFile);
		const period = state.last_ok ?? 'never';
		const old = this.isStale(state.last_ok ?? state.first_seen);
		const fileError = trackerBackupFileError(directory, state);
		const key = old ? period : fileError;
		if (key === null || state.stale_flagged_for === key) return;
		const cause = state.last_error ? `; last error: ${state.last_error}` : '';
		const question = old
			? `Tracker backups are stale: no good backup for over 36 hours (last: ${period})${cause}`
			: `Tracker backup file check failed: ${fileError}`;
		await raiseTrackerBackupAlert(items, stateFile, question);
		writeTrackerBackupState(stateFile, { stale_flagged_for: key });
	}
}
