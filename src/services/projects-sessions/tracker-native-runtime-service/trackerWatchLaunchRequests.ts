// @harness-uid u_bl6xl2h4a3
import { trackerManualIntakeProjection } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { randomUUID } from 'node:crypto';
import { dispatchLaunchSource } from '../../../repositories/projects-sessions/tracker-dispatch-repository/dispatchItemFields';
import { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import { trackerClockMilliseconds } from '../../../utils/projects-sessions/nextTrackerClock';
import { trackerScheduleHold } from '../../../utils/projects-sessions/trackerScheduleHold';
import type {
	TrackerItem,
	TrackerItemRow
} from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerDispatcherService } from '../../agents-providers/TrackerDispatcherService';
import { watchdogManualPrefix } from '../WatchdogPaneService';
import type { WatchdogScan } from '../WatchdogPaneService.types';
import { trackerSessionItemPrefix } from '../tracker-local-api-service/trackerLocalItemMutation';
import {
	canonicalNode,
	finalReportHold
} from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { recordWatchdogAlert, urgentQueueAlertKind } from './trackerHostWatchdogAlerts';
import { readWatchdogAlerts } from './trackerHostWatchdogState';

export const launchWithoutRunKind = 'launch-without-run';
const requestGrace = 60_000;
const overdueQueueGrace = 30 * requestGrace;
const urgentQueueGrace = 15 * requestGrace;
const launchQueueStuckKind = 'launch-queue-stuck';
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
	const unchangedSince = now - minutes * requestGrace;
	const runs = new TrackerRunReadRepository(store.database, store.node);
	const active = new Set<string>();
	for (const item of rows) {
		signal.throwIfAborted();
		if (!untouchedTask(item, unchangedSince) || attachedWork(store, item, snapshot)) continue;
		if (existingWork(item, runs)) continue;
		const result = await dispatch.request(item.id, {
			source: 'automatic',
			token: randomUUID(),
			unchangedSince
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
			now
		);
	}
	retainLaunchAlerts(store, idleWorkAlert, active);
}

function existingWork(item: TrackerItem, runs: TrackerRunReadRepository) {
	const history = runs.list({ itemId: item.id });
	if (item.auto && !history.some((run) => run.auto_token === item.auto)) return true;
	const latest = history.at(-1);
	if (latest && finalReportHold(latest, Date.parse(item.answered_at ?? '') || 0)) return true;
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
export function watchLaunchRequests(
	store: TrackerPersistenceService,
	now: number,
	canAutoLaunch = true
): boolean {
	const runs = new TrackerRunReadRepository(store.database, store.node);
	const due = unclaimedRequests(store, now).flatMap((request) => {
		if (request.source !== 'manual' && !canAutoLaunch && request.priority !== 'urgent') return [];

		const attempts = runs
			.list({ itemId: request.id })
			.filter((run) => run.auto_token === request.auto);
		const alert = classifyLaunchWait(request, attempts);
		return alert ? [{ ...request, ...alert }] : [];
	});
	const keyFor = ({ id, kind }: (typeof due)[number]) => `${id}:${kind}`;
	const active = new Set(due.map(keyFor));
	retainLaunchAlerts(store, launchWithoutRunKind, active);
	retainLaunchAlerts(store, launchQueueStuckKind, active);
	const previous = retainLaunchAlerts(store, urgentQueueAlertKind, active);
	let added = false;
	for (const request of due) {
		const { id, computer, clock, kind, minutes } = request;
		const key = keyFor(request);
		if (previous[key]?.identity === clock) continue;
		recordWatchdogAlert(
			store,
			{
				itemId: id,
				host: computer,
				kind,
				key,
				identity: clock,
				reason:
					kind !== launchWithoutRunKind
						? `Launch on ${computer} has been queued for more than ${minutes} minutes without a started run.`
						: `Launch request has had no run on ${computer} for at least 60 seconds.`
			},
			now
		);
		added = true;
	}
	return added;
}

function classifyLaunchWait(
	request: ReturnType<typeof unclaimedRequests>[number],
	attempts: ReturnType<TrackerRunReadRepository['list']>
) {
	const urgent = request.priority === 'urgent';
	const wait = urgent ? urgentQueueGrace : overdueQueueGrace;
	const stillQueued = !attempts.length || attempts.some((run) => run.state === 'queued');
	if (request.age > wait && stillQueued && !attempts.some((run) => run.started_at != null))
		return {
			kind: urgent ? urgentQueueAlertKind : launchQueueStuckKind,
			minutes: wait / requestGrace
		};
	if (request.source === 'manual' && !attempts.length)
		return { kind: launchWithoutRunKind, minutes: 1 };
	return undefined;
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
			`SELECT i.*, ${dispatchLaunchSource} AS source, ${trackerManualIntakeProjection},
			CASE WHEN auto IS NOT NULL THEN json_extract(clocks, '$.auto') ELSE json_extract(clocks, '$.due') END AS clock,
			coalesce(nullif(launch_target,'auto'),nullif(computer,'auto'),created_by,?) AS target
		FROM items i WHERE deleted = 0 AND title IS NOT NULL AND (
			auto IS NOT NULL OR (priority = 'urgent' AND adapter_due_owner IS NOT NULL AND due IS NOT NULL)
		)
		AND status IN ('open','in_progress') AND coalesce(kind, 'task') = 'task'
		AND (needs_daniel = 0 OR resolved = 1)`
		)
		.all(store.node) as (TrackerItemRow & {
		auto: string;
		clock: string | null;
		target: string;
		source: string;
		priority: string | null;
	})[];
	return rows.flatMap((row) => {
		const { id, auto, clock, target, source, priority, due } = row;
		if (!auto && trackerScheduleHold(row, now)) return [];
		const at = trackerClockMilliseconds(clock ?? '');
		return clock && at && (auto || Date.parse(due ?? '') <= now) && now - at >= requestGrace
			? [{ id, auto, clock, source, priority, age: now - at, computer: canonicalNode(target, {}) }]
			: [];
	});
}
