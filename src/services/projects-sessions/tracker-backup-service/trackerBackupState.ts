// @harness-uid u_im4swoqn6p
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import type { TrackerBackupState } from './trackerBackupState.types';

const text = z.string().nullable().default(null);
const stateSchema = z.object({
	first_seen: text,
	last_ok: text,
	last_ok_file: text,
	last_ok_size: z.number().nullable().default(null),
	last_error: text,
	last_error_at: text,
	last_scheduled_day: text,
	stale_flagged_for: text,
	alert_item: text
});

/** Backup history lives beside the journal, so restoring the journal never rewrites it. */
export function readTrackerBackupState(path: string): TrackerBackupState {
	try {
		return stateSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
	} catch (error) {
		const missing = error instanceof Error && 'code' in error && error.code === 'ENOENT';
		if (!missing && !(error instanceof SyntaxError)) throw error;
		return stateSchema.parse({});
	}
}

export function writeTrackerBackupState(
	path: string,
	changes: Partial<TrackerBackupState>
): TrackerBackupState {
	const state = { ...readTrackerBackupState(path), ...changes };
	const temporary = `${path}.tmp`;
	writeFileSync(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
	renameSync(temporary, path);
	return state;
}
