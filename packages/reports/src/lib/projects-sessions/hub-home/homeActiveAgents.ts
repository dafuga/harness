// @harness-uid u_ycwagentct
import type {
	IncludedTrackerItem,
	TrackerRunRecord
} from '../project-overview/projectOverviewTracker.types';
import { isActiveHomeRun } from './buildHomeMachines';

function isRunning(run: TrackerRunRecord, offline: ReadonlySet<string>) {
	return isActiveHomeRun(run) && !(run.node && offline.has(run.node));
}

/** @pure Distinct project and owner pairs with a live run. */
export function activeAgentCount(
	items: IncludedTrackerItem[],
	runs: ReadonlyMap<string, TrackerRunRecord[]>,
	offline: ReadonlySet<string>
) {
	const identities = new Set<string>();
	for (const item of items) {
		if (
			!runs
				.get(item.id)
				?.some((run) => run.ended_at === null && isRunning(run, offline))
		)
			continue;
		const project = (item.project?.trim() || item.agent).toLowerCase();
		const owner = item.owner?.trim().toLowerCase() || null;
		identities.add(JSON.stringify([project, owner]));
	}
	return identities.size;
}
