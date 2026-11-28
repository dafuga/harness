// @harness-uid u_p4u7mgjvfn
import type { TrackerAwaitingItem } from './isTrackerAwaitingAnswer.types';

/** @pure An open question pauses its session whether or not Daniel can see it yet. */
export function isTrackerAwaitingAnswer(item: TrackerAwaitingItem): boolean {
	return Boolean(item.review_status || (item.needs_daniel && !item.resolved));
}
