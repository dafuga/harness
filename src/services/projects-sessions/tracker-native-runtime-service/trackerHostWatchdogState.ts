// @harness-uid u_bl6xl2h4a3
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { WatchdogItem, WatchdogRun } from '../WatchdogPaneService.types';
import { trackerWatchdogAlerts } from './trackerHostWatchdogSchema';

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
