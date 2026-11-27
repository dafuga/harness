// @harness-uid u_bl6xl2h4a3
import type { TrackerRunReceipt } from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { watchTrackerQuota } from './trackerProviderHolds';
import type { TrackerTmuxAdapter } from '../../../adapters/projects-sessions/TrackerTmuxAdapter';
import { watchdogManualPrefix } from '../WatchdogPaneService';
import type { WatchdogPane } from '../WatchdogPaneService.types';
import { paneBackgroundWork } from '../watchdog-pane-service/paneBackgroundWork';
import { closeFinishedTrackerSessions } from './trackerFinishedSessions';
import type { TrackerHostLaunchPort, TrackerHostSession } from './trackerHostLaunch.types';

const runSessionName = /^auto-([a-z0-9]{6,10})-r([1-9][0-9]*)$/;
/** Only a quiet pane is captured to look for work that prints nothing. */
const quietPane = 5 * 60_000;

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
	signal.throwIfAborted();
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
	signal.throwIfAborted();
	if (tmux) await closeFinishedTrackerSessions(store, { tmux, panes, node, now }, signal);
	const active = tmux ? await withPaneActivity(sessions, { tmux, panes, now }, signal) : sessions;
	return { sessions: [...active, ...direct], panes, windows };
}

/** The launcher's receipt has no activity time; its own pane does. */
async function withPaneActivity(
	sessions: readonly TrackerHostSession[],
	{ tmux, panes, now }: { tmux: TrackerTmuxAdapter; panes: readonly WatchdogPane[]; now: number },
	signal: AbortSignal
): Promise<TrackerHostSession[]> {
	const observed = [];
	for (const session of sessions) {
		signal.throwIfAborted();
		const pane = panes.find(
			({ name, live, runnerSocket }) => live && runnerSocket && name === session.tmux
		);
		if (!pane || session.state !== 'live') {
			observed.push(session);
			continue;
		}
		const working =
			now - pane.activity >= quietPane && paneBackgroundWork(await tmux.captured(pane, signal));
		const activityAt = Math.max(session.activityAt ?? 0, working ? now : pane.activity);
		observed.push({ ...session, activityAt });
	}
	return observed;
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

/** A blocked receipt can still have a working pane. */
export function retiredTrackerSession(
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
			AND json_array(item_id, auto_token, attempt) = ? AND state = 'finished'
			AND outcome IS NOT 'blocked'`
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
