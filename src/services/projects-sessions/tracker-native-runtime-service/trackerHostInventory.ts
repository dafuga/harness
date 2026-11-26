// @harness-uid u_bl6xl2h4a3
import type { TrackerRunReceipt } from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { watchTrackerQuota } from './trackerProviderHolds';
import type { TrackerTmuxAdapter } from '../../../adapters/projects-sessions/TrackerTmuxAdapter';
import { watchdogManualPrefix } from '../WatchdogPaneService';
import type { WatchdogPane } from '../WatchdogPaneService.types';
import { closeFinishedTrackerSessions } from './trackerFinishedSessions';
import type { TrackerHostLaunchPort, TrackerHostSession } from './trackerHostLaunch.types';

const runSessionName = /^auto-([a-z0-9]{6,10})-r([1-9][0-9]*)$/;

export async function trackerHostInventory(
	{
		store,
		driver,
		tmux,
		node,
		runs,
		keys,
		now
	}: {
		store: TrackerPersistenceService;
		driver: TrackerHostLaunchPort;
		tmux?: TrackerTmuxAdapter;
		node: string;
		runs: readonly TrackerRunReceipt[];
		keys: readonly string[];
		now: number;
	},
	signal: AbortSignal
) {
	const [sessions, panes, windows] = await Promise.all([
		driver.inspect({ node, keys }, signal),
		tmux?.inventory(signal) ?? [],
		tmux?.windows(signal) ?? []
	]);
	const direct = panes.flatMap((pane) => {
		const evidence = legacyTmuxSession(pane);
		return evidence &&
			!sessions.some(
				(entry) => entry.tmux === evidence.tmux || entry.legacyRunId === evidence.legacyRunId
			)
			? [evidence]
			: [];
	});
	await watchTrackerQuota(store, { tmux, runs, now }, signal);
	if (tmux) await closeFinishedTrackerSessions(store, { tmux, panes, node, now }, signal);
	return { sessions: [...sessions, ...direct], panes, windows };
}

export function hasManualTrackerPane(panes: readonly WatchdogPane[], itemId: string) {
	return panes.some((pane) => {
		const prefix = watchdogManualPrefix(pane.name);
		return pane.live && prefix !== undefined && itemId.startsWith(prefix);
	});
}

function legacyTmuxSession(pane: WatchdogPane): TrackerHostSession | undefined {
	const match = runSessionName.exec(pane.name);
	if (!pane.runnerSocket || !match || !pane.ready || !pane.live) return undefined;
	const [, itemId, runId] = match;
	return {
		itemId,
		key: 'legacy:' + runId,
		id: pane.key,
		state: 'live',
		tmux: pane.name,
		legacyRunId: Number(runId),
		startedAt: pane.createdAt,
		activityAt: pane.activity
	};
}

export function finishedTrackerSession(
	store: TrackerPersistenceService,
	session: TrackerHostSession
): boolean {
	const { itemId, key, id, legacyRunId, tmux } = session;
	const { database } = store;
	return Boolean(
		legacyRunId === undefined
			? database
					.prepare(
						`SELECT 1 FROM runs WHERE item_id = ? AND session_id = ?
			AND json_array(item_id, auto_token, attempt) = ? AND state = 'finished'`
					)
					.get(itemId, id, key)
			: database
					.prepare(
						`SELECT 1 FROM runs WHERE id = ? AND tmux = ?
			AND (item_id = ? OR substr(item_id, 1, 6) = ?) AND state = 'finished'`
					)
					.get(legacyRunId, tmux ?? null, itemId, itemId)
	);
}
