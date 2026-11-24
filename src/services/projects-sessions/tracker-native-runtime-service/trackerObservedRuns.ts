// @harness-uid u_bl6xl2h4a3
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import { WatchdogPaneService } from '../WatchdogPaneService';
import type { WatchdogPane } from '../WatchdogPaneService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { handLaunchSelection } from './trackerHandLaunchSelection';
import { watchdogItem } from './trackerHostWatchdogState';

const sessions = new WatchdogPaneService();

export function adoptTrackerHandLaunches(
	store: TrackerPersistenceService,
	items: readonly TrackerItem[],
	panes: readonly WatchdogPane[]
) {
	const byId = new Map(items.map((item) => [item.id, item]));
	const rows = items.map(watchdogItem);
	const candidates = new Map<string, WatchdogPane | null>();
	for (const pane of panes) {
		if (!pane.live || !observedProvider(pane)) continue;
		const item = sessions.manualItem(pane, rows);
		if (item?.status !== 'in_progress') continue;
		candidates.set(item.id, candidates.has(item.id) ? null : pane);
	}
	const runs = new TrackerRunReadRepository(store.database, store.node);
	for (const [id, pane] of candidates) {
		if (!pane) continue;
		const history = runs.list({ itemId: id });
		if (
			history.some(
				({ state, tmux }) =>
					['running', 'verifying'].includes(state) || (state === 'observed' && tmux !== pane.name)
			)
		)
			continue;
		adoptPane(store, byId.get(id)!, pane);
	}
}

function adoptPane(store: TrackerPersistenceService, item: TrackerItem, pane: WatchdogPane) {
	const cli = observedProvider(pane);
	const selection = handLaunchSelection(item, store.node, pane);
	const verified = selection?.cli === cli ? selection : undefined;
	store.commitLocal(() => {
		store.database
			.prepare(
				`INSERT INTO runs (
				item_id, rung, cli, model, effort, pinned, state, queued_at, started_at, tmux, watch_pane,
				kind, project, reason
			) SELECT ?, ?, ?, ?, ?, ?, 'observed', ?, ?, ?, ?, ?, ?, 'Hand-launched tmux session'
			WHERE NOT EXISTS (SELECT 1 FROM runs WHERE watch_pane = ?)`
			)
			.run(
				item.id,
				verified?.id ?? 'manual',
				cli,
				verified?.model ?? 'unknown',
				verified?.effort ?? null,
				Number(Boolean(verified)),
				pane.createdAt,
				pane.createdAt,
				pane.name,
				pane.key,
				item.kind,
				item.project ?? item.agent,
				pane.key
			);
		// The transcript or a launch note may appear after the first observation.
		if (verified)
			store.database
				.prepare(
					`UPDATE runs SET rung = ?, model = ?, effort = ?, pinned = 1
				WHERE watch_pane = ? AND state = 'observed' AND model = 'unknown'`
				)
				.run(verified.id, verified.model, verified.effort ?? null, pane.key);
		return { result: undefined };
	});
}

function observedProvider(pane: WatchdogPane) {
	if (pane.currentCommand === 'codex' || pane.model?.startsWith('gpt-')) return 'codex';
	if (pane.currentCommand === 'claude' || pane.model?.startsWith('claude-')) return 'claude';
	return sessions.idlePrompt(pane);
}
