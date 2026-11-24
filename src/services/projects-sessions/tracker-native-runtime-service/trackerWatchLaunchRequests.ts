// @harness-uid u_bl6xl2h4a3
import { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import { trackerClockMilliseconds } from '../../../utils/projects-sessions/nextTrackerClock';
import { canonicalNode } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { recordWatchdogAlert } from './trackerHostWatchdogAlerts';
import { readWatchdogAlerts } from './trackerHostWatchdogState';

export const launchWithoutRunKind = 'launch-without-run';
const requestGrace = 60_000;

/** Track the current launch request even when the target host has no attached tmux pane. */
export function watchLaunchRequests(store: TrackerPersistenceService, now: number): boolean {
	const runs = new TrackerRunReadRepository(store.database, store.node);
	const overdue = unclaimedRequests(store, now).filter(
		({ id, auto }) => !runs.list({ itemId: id }).some((run) => run.auto_token === auto)
	);
	const active = new Set(overdue.map(({ id }) => launchAlertKey(id)));
	const previous = readWatchdogAlerts(store);
	const retained = Object.entries(previous).filter(
		([key, alert]) => alert.kind !== launchWithoutRunKind || active.has(key)
	);
	if (retained.length !== Object.keys(previous).length)
		store.writeMeta({ watchdog_alerts: JSON.stringify(Object.fromEntries(retained)) });
	let added = false;
	for (const { id, computer, clock } of overdue) {
		const key = launchAlertKey(id);
		if (previous[key]?.identity === clock) continue;
		recordWatchdogAlert(
			store,
			{
				itemId: id,
				host: computer,
				kind: launchWithoutRunKind,
				key,
				identity: clock,
				reason: `Launch request has had no run on ${computer} for at least 60 seconds.`
			},
			now,
			null
		);
		added = true;
	}
	return added;
}

function unclaimedRequests(store: TrackerPersistenceService, now: number) {
	const rows = store.database
		.prepare(
			`SELECT id, auto, json_extract(clocks, '$.auto') AS clock,
			coalesce(nullif(launch_target,'auto'),nullif(computer,'auto'),created_by,?) AS target
		FROM items WHERE deleted = 0 AND auto IS NOT NULL AND title IS NOT NULL
		AND status IN ('open','in_progress')`
		)
		.all(store.node) as { id: string; auto: string; clock: string | null; target: string }[];
	return rows.flatMap(({ id, auto, clock, target }) => {
		const at = trackerClockMilliseconds(clock ?? '');
		return clock && at && now - at >= requestGrace
			? [{ id, auto, clock, computer: canonicalNode(target, {}) }]
			: [];
	});
}

function launchAlertKey(id: string) {
	return `${id}:${launchWithoutRunKind}`;
}
