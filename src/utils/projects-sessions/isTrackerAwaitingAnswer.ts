// @harness-uid u_bl6xl2h4a3
import type { TrackerAwaitingItem } from './isTrackerAwaitingAnswer.types';

/** @pure An open question pauses its session whether or not Daniel can see it yet. */
export function isTrackerAwaitingAnswer(item: TrackerAwaitingItem): boolean {
	const asked = Boolean(item.needs_daniel) && !item.resolved;
	return Boolean(item.review_status) || asked;
}
