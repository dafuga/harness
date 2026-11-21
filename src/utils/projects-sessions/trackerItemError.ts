// @harness-uid u_gfp6bkgz67
import type { TrackerDuplicateDetails, TrackerItemRequestError } from './checkTrackerItem.types';

export function trackerItemError(
	message: string,
	status = 400,
	body?: TrackerDuplicateDetails
): TrackerItemRequestError {
	return Object.assign(new Error(message), { status, ...(body ? { body } : {}) });
}
