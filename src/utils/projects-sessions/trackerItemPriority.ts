// @harness-uid u_dv4lnm54rz
import type { TrackerItemPriority, TrackerItemValue } from './normalizeTrackerItemFields.types';
import { trackerItemError } from './trackerItemError';

export function trackerItemPriority(
	value: TrackerItemValue,
	fallback?: TrackerItemPriority
): TrackerItemPriority {
	if (value === 'urgent' || value === 'normal' || value === 'low') return value;
	if (fallback) return fallback;
	throw trackerItemError('priority must be urgent, normal or low');
}
