import type { TrackerDuplicateDetails } from './checkTrackerItem.types';

export function trackerItemError(message: string, status = 400, body?: TrackerDuplicateDetails) {
	return Object.assign(new Error(message), { status, ...(body ? { body } : {}) });
}
