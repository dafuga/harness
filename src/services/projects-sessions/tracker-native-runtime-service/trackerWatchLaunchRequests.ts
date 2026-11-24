// @harness-uid u_bl6xl2h4a3
import { randomUUID } from 'node:crypto';
import { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import { trackerClockMilliseconds } from '../../../utils/projects-sessions/nextTrackerClock';
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { isQuietHour } from '../../../helpers/attention-timing/isQuietHour';
import { trackerTimeZone } from '../../../utils/projects-sessions/normalizeTrackerDue';
import type { TrackerDispatcherService } from '../../agents-providers/TrackerDispatcherService';
import { watchdogManualPrefix } from '../WatchdogPaneService';
import type { WatchdogScan } from '../WatchdogPaneService.types';
import { trackerSessionItemPrefix } from '../tracker-local-api-service/trackerLocalItemMutation';
import { canonicalNode } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { recordWatchdogAlert } from './trackerHostWatchdogAlerts';
import { readWatchdogAlerts } from './trackerHostWatchdogState';

export const launchWithoutRunKind = 'launch-without-run';
const requestGrace = 60_000;
const idleWorkAlert = 'idle-work-unassigned';

export async function queueIdleWork(
	store: TrackerPersistenceService,
	{
		rows,
		snapshot,
		dispatch,
		minutes
	}: {
		rows: readonly TrackerItem[];
		snapshot: WatchdogScan;
		dispatch: TrackerDispatcherService;
		minutes: number;
	},
	signal: AbortSignal
) {
	const { now } = snapshot;
	if (isQuietHour(now, { start: '22:00', end: '08:00', tz: trackerTimeZone })) return;
	const unchangedSince = now - minutes * requestGrace;
	const runs = new TrackerRunReadRepository(store.database, store.node);
	const active = new Set<string>();
	for (const item of rows) {
		signal.throwIfAborted();
		if (!untouchedTask(item, unchangedSince) || attachedWork(store, item, snapshot)) continue;
		if (existingWork(item, runs)) continue;
		const result = await dispatch.request(item.id, {
			source: 'manual',
			token: randomUUID(),
			unattended: { unchangedSince }
		});
		if (result.status !== 'held' || !/computer|repository|workdir/i.test(result.reason)) continue;
		const key = `${item.id}:${idleWorkAlert}`;
		active.add(key);
		recordWatchdogAlert(
			store,
			{
				itemId: item.id,
				key,
				kind: idleWorkAlert,
				identity: item.updated_at ?? item.id,
				reason: `Idle task could not be placed: ${result.reason}. Chief of Staff, please assign a computer or resolve its launch route.`,
				localOnly: true
			},
			now,
			null
		);
	}
	retainLaunchAlerts(store, idleWorkAlert, active);
}

function existingWork(item: TrackerItem, runs: TrackerRunReadRepository) {
	const history = runs.list({ itemId: item.id });
	if (item.auto && !history.some((run) => run.auto_token === item.auto)) return true;
	// The dropped-session policy already owns recovery after a started attempt.
	return item.status === 'in_progress' && history.some((run) => run.started_at != null);
}

function untouchedTask(item: TrackerItem, cutoff: number): boolean {
	return (
		item.kind === 'task' &&
		!item.recurring &&
		!item.schedule_off &&
		(item.status === 'open' || item.status === 'in_progress') &&
		(!item.needs_daniel || item.resolved) &&
		Date.parse(item.updated_at ?? '') <= cutoff
	);
}

function attachedWork(store: TrackerPersistenceService, item: TrackerItem, snapshot: WatchdogScan) {
	return snapshot.panes.some(({ live, name }) => {
		if (!live) return false;
		const [, prefix, runId] = /^auto-([a-z0-9]{6,10})(?:-r([1-9][0-9]*))?$/.exec(name) ?? [];
		const owner = prefix ?? watchdogManualPrefix(name);
		if (owner && item.id.startsWith(owner)) return true;
		return Boolean(runId && store.getMeta(`${trackerSessionItemPrefix}${runId}:${item.id}`));
	});
}

/** Track the current launch request even when the target host has no attached tmux pane. */
export function watchLaunchRequests(store: TrackerPersistenceService, now: number): boolean {
	const runs = new TrackerRunReadRepository(store.database, store.node);
	const overdue = unclaimedRequests(store, now).filter(
		({ id, auto }) => !runs.list({ itemId: id }).some((run) => run.auto_token === auto)
	);
	const active = new Set(overdue.map(({ id }) => launchAlertKey(id)));
	const previous = retainLaunchAlerts(store, launchWithoutRunKind, active);
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

function retainLaunchAlerts(store: TrackerPersistenceService, kind: string, active: Set<string>) {
	const previous = readWatchdogAlerts(store);
	const retained = Object.entries(previous).filter(
		([key, alert]) => alert.kind !== kind || active.has(key)
	);
	if (retained.length !== Object.keys(previous).length)
		store.writeMeta({ watchdog_alerts: JSON.stringify(Object.fromEntries(retained)) });
	return previous;
}

function unclaimedRequests(store: TrackerPersistenceService, now: number) {
	const rows = store.database
		.prepare(
			`SELECT id, auto, json_extract(clocks, '$.auto') AS clock,
			coalesce(nullif(launch_target,'auto'),nullif(computer,'auto'),created_by,?) AS target
		FROM items WHERE deleted = 0 AND auto IS NOT NULL AND title IS NOT NULL
		AND status IN ('open','in_progress') AND coalesce(launch_source, 'manual') <> 'recovery'`
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
