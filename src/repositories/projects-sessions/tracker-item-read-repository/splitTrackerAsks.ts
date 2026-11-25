// @harness-uid u_ptjz1dsplt
import { isTrackerPing } from '../../../utils/projects-sessions/isTrackerPing';
import type { TrackerDigestGroups, TrackerDigestItem } from '../TrackerItemReadRepository.types';

/** A decision waiting this long is listed as stale on every digest. */
export const trackerStaleDecisionMinutes = 24 * 60;

export function isStaleDecision(item: TrackerDigestItem): boolean {
	return (item.waiting_minutes ?? 0) >= trackerStaleDecisionMinutes;
}

/** Split open flags into Daniel decisions and automated pings, each oldest first. */
export function splitTrackerAsks(groups: TrackerDigestGroups): void {
	const oldestFirst = (a: TrackerDigestItem, b: TrackerDigestItem) =>
		(b.waiting_minutes ?? 0) - (a.waiting_minutes ?? 0);
	for (const item of groups.needs_daniel)
		(isTrackerPing(item.question) ? groups.pings : groups.daniel_decisions).push(item);
	groups.daniel_decisions.sort(oldestFirst);
	groups.pings.sort(oldestFirst);
}
