// @harness-uid u_gfp6bkgz67
import type {
	TrackerItemMatches,
	TrackerMatchOptions,
	TrackerMatchRow
} from './checkTrackerItem.types';

export function checkTrackerItem(
	_rows: readonly TrackerMatchRow[],
	_text: unknown,
	_options: TrackerMatchOptions = {}
): TrackerItemMatches {
	return { ignored: [], open: [] };
}
