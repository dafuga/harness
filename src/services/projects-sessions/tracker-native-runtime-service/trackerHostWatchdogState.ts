// @harness-uid u_bl6xl2h4a3
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerNativeRuntimeService } from '../TrackerNativeRuntimeService';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type {
	WatchdogItem,
	WatchdogPane,
	WatchdogRun,
	WatchdogScan
} from '../WatchdogPaneService.types';
import { createHash } from 'node:crypto';
import { trackerSessionItemPrefix } from '../tracker-local-api-service/trackerLocalItemMutation';
import type { TrackerHandoffAttempt } from './trackerWatchdogContext.types';
import { heldTrackerProviders } from './trackerProviderHolds';
import { trackerWatchdogAlerts } from './trackerHostWatchdogSchema';
import { trackerMachineSample } from './trackerFleetSampleSchema';
import { staleDispatchHeartbeatKind } from './trackerCosAlertKinds';

export function watchdogItem(item: TrackerItem): WatchdogItem {
	return {
		id: item.id,
		title: item.title ?? '',
		status: (item.status ?? 'ignored') as WatchdogItem['status'],
		deleted: item.deleted,
		needsDaniel: item.needs_daniel,
		resolved: item.resolved,
		question: item.question,
		notes: item.notes_log.map(({ node, text, at }) => ({
			node: node ?? '',
			text,
			at: Date.parse(at)
		}))
	};
}

export function localWatchdogRuns(store: TrackerPersistenceService): WatchdogRun[] {
	const { database } = store;
	if (!database.prepare("SELECT 1 FROM sqlite_schema WHERE name = 'runs' AND type = 'table'").get())
		return [];
	return database
		.prepare(
			`SELECT
		id, item_id AS itemId, cli, state, tmux, outcome, idle_nudges AS idleNudges,
		watch_pane AS watchPane, started_at AS startedAt, resumed_at AS resumedAt,
		idle_nudged_at AS idleNudgedAt, idle_escalated_at AS idleEscalatedAt
		FROM runs WHERE state IN ('running','observed') AND cli IN ('codex','claude')`
		)
		.all() as WatchdogRun[];
}

export function readWatchdogAlerts(store: TrackerPersistenceService) {
	return trackerWatchdogAlerts.parse(JSON.parse(store.getMeta('watchdog_alerts') ?? '{}'));
}

export function finishObservedRuns(
	store: TrackerPersistenceService,
	ids: readonly number[],
	now: number
): void {
	if (!ids.length) return;
	store.commitLocal(() => {
		const finish = store.database
			.prepare(`UPDATE runs SET state = 'finished', outcome = 'abandoned',
			failure_reason = 'Hand-launched session ended or its item closed', ended_at = ?
			WHERE id = ? AND state = 'observed'`);
		for (const id of ids) finish.run(now, id);
		return { result: undefined };
	});
}
export function watchdogSnapshot(
	store: TrackerPersistenceService,
	items: readonly TrackerItem[],
	panes: readonly WatchdogPane[],
	now: number
): WatchdogScan {
	const allItems = items.map(watchdogItem);
	const runs = localWatchdogRuns(store);
	for (const pane of panes) {
		const run = runs.find(
			(candidate) => candidate.tmux === pane.name || candidate.watchPane === pane.key
		);
		if (!run) continue;
		const seen = Number(store.getMeta(paneNudgeKey(pane)) ?? 0);
		if (seen > (run.idleNudgedAt ?? 0)) {
			run.idleNudgedAt = seen;
			run.idleNudges = 1;
		}
	}
	return {
		panes,
		runs,
		items: allItems,
		now,
		host: store.node,
		quotaHolds: heldTrackerProviders(store)
	};
}

export function paneNudgeKey({ key }: WatchdogPane): string {
	return 'tracker_host_watchdog_nudge:' + createHash('sha256').update(key).digest('hex');
}
export function handoffRunOwnership(
	store: TrackerPersistenceService,
	{ id, runId, pane }: { id: string; runId: number; pane: WatchdogPane }
): Pick<TrackerHandoffAttempt, 'token' | 'observed'> | undefined {
	const row = store.database
		.prepare(
			`SELECT state, model, session_id AS token FROM runs
		WHERE id = ? AND item_id = ? AND tmux = ?
		AND (state = 'running' OR (state = 'observed' AND watch_pane = ?))
		AND ABS(started_at - ?) <= 60000
		AND NOT EXISTS (
			SELECT 1 FROM meta link JOIN items owner ON owner.id = link.v
			WHERE link.k GLOB ? AND owner.deleted = 0 AND owner.status NOT IN ('done', 'ignored')
		)`
		)
		.get(
			runId,
			id,
			pane.name,
			pane.key,
			pane.createdAt,
			`${trackerSessionItemPrefix}${runId}:*`
		) as { state: string; model: string; token?: string } | undefined;
	if (
		row?.state === 'observed' &&
		/^[a-z0-9][a-z0-9._-]{1,79}$/i.test(row.model) &&
		row.model !== 'unknown'
	)
		return { observed: true };
	return row?.token && /^[a-f0-9]{64}$/.test(row.token) ? { token: row.token } : undefined;
}
export function activeWatchdogItem(
	items: TrackerItemReadRepository,
	id: string
): TrackerItem | undefined {
	try {
		const item = items.getStored(id);
		if (!item.deleted && item.status !== 'done' && item.status !== 'ignored') return item;
	} catch {
		return undefined;
	}
	return undefined;
}

const dispatchHeartbeatGrace = 3 * 60_000;

/** One stable alert identity per computer and missed heartbeat, until the launcher recovers. */
export function staleDispatchAlerts(
	runtime: Pick<TrackerNativeRuntimeService, 'store' | 'scheduler' | 'fleetSamples' | 'now'>
) {
	const { store, scheduler, fleetSamples, now } = runtime;
	const reports = (fleetSamples?.() ?? []).flatMap((sample) => {
		const report = trackerMachineSample.safeParse(sample).data;
		return report && report.node !== store.node ? [report] : [];
	});
	const local = { node: store.node, runner: scheduler?.runnerStatus() };
	const checkedAt = now();
	return [...reports, local].flatMap(({ node, runner }) => {
		if (!runner?.enabled || !/^[a-z0-9][a-z0-9._-]*$/i.test(node)) return [];
		const lastTick = Date.parse(runner.last_tick_at ?? '');
		const at = lastTick + dispatchHeartbeatGrace;
		if (!(checkedAt > at)) return [];
		return [
			{
				id: `${node}:${staleDispatchHeartbeatKind}:${at}`,
				item_id: 'scheduler',
				host: node,
				kind: staleDispatchHeartbeatKind,
				identity: String(lastTick),
				reason: `Tracker launch scheduler last completed a tick at ${new Date(lastTick).toISOString()}. Check the dispatch worker and host commands on this computer.`,
				at
			}
		];
	});
}
