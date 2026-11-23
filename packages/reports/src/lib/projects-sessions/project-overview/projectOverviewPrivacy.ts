// @harness-uid u_na5l2yswov
import type { IncludedTrackerItem, TrackerItemRecord } from './projectOverviewTracker.types';

export { sanitizeTrackerText as sanitizeText } from '../../../../../../src/utils/projects-sessions/sanitizeTrackerText';

/**
 * @pure Only items that may appear on a card. Deleted and sensitive records are dropped,
 * ignored records never affect a state, and an item with no agent names no project.
 */
export function isIncludedItem(item: TrackerItemRecord): item is IncludedTrackerItem {
	return (
		!item.deleted &&
		!item.sensitive &&
		item.status !== 'ignored' &&
		typeof item.agent === 'string' &&
		item.agent.length > 0
	);
}
