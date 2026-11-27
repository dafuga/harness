// @harness-uid u_im4swoqn6p
import { readTrackerBackupFiles } from '../tracker-node-service/readTrackerBackupList';
import type { TrackerBackupState } from './trackerBackupState.types';

/** The state file only records what was written; this checks what is on disk now. */
export function trackerBackupFileError(
	directory: string,
	state: TrackerBackupState
): string | null {
	const { last_ok_file: name, last_ok_size: size } = state;
	if (!name) return null;
	const found = readTrackerBackupFiles(directory).find((file) => file.name === name);
	if (!found) return `${name} is missing from the backup folder`;
	if (found.size === size) return null;
	return `${name} is ${found.size} bytes on disk, but the last good backup wrote ${size} bytes`;
}
