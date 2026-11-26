// @harness-uid u_ha3divi7yk
// @harness-uid u_ptjz1dsplt
import { trackerFlagKind } from '../../../utils/projects-sessions/trackerStructuredAsk';
import type { TrackerDigestGroups, TrackerDigestItem } from '../TrackerItemReadRepository.types';

/** A decision waiting this long is listed as stale on every digest. */
export const trackerStaleDecisionMinutes = 24 * 60;

export function isStaleDecision(item: TrackerDigestItem): boolean {
	return (item.waiting_minutes ?? 0) >= trackerStaleDecisionMinutes;
}

/**
 * Split open flags, each oldest first: structured asks are Daniel's decisions; automated pings and
 * flags that offer no choices are for Chief of Staff and are never shown to Daniel.
 */
export function splitTrackerAsks(groups: TrackerDigestGroups): void {
	const oldestFirst = (a: TrackerDigestItem, b: TrackerDigestItem) =>
		(b.waiting_minutes ?? 0) - (a.waiting_minutes ?? 0);
	const lists = {
		ask: groups.daniel_decisions,
		ping: groups.pings,
		'needs-options': groups.needs_options
	};
	for (const item of groups.needs_daniel) {
		const kind = trackerFlagKind(item);
		if (kind) lists[kind].push(item);
	}
	for (const list of Object.values(lists)) list.sort(oldestFirst);
}
