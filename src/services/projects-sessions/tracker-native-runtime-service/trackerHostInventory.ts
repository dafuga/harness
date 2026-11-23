// @harness-uid u_bl6xl2h4a3
import { trackerManagedToken } from '../../../adapters/projects-sessions/tracker-tmux-adapter/trackerManagedLaunchReceipt';
import { trackerClockMilliseconds } from '../../../utils/projects-sessions/nextTrackerClock';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerTmuxAdapter } from '../../../adapters/projects-sessions/TrackerTmuxAdapter';
import type { WatchdogPane } from '../WatchdogPaneService.types';
import { trackerSessionItemPrefix } from '../tracker-local-api-service/trackerLocalItemMutation';
import type {
	CompletedTrackerPaneRun,
	TrackerHostLaunchPort,
	TrackerHostSession
} from './trackerHostLaunch.types';

const completedSessionGrace = 10 * 60_000;
const runSessionName = /^auto-([a-z0-9]{6,10})-r([1-9][0-9]*)$/;

export async function trackerHostInventory(
	{
		store,
		driver,
		tmux,
		node,
		keys,
		now
	}: {
		store: TrackerPersistenceService;
		driver: TrackerHostLaunchPort;
		tmux?: TrackerTmuxAdapter;
		node: string;
		keys: readonly string[];
		now: number;
	},
	signal: AbortSignal
) {
	const [sessions, panes] = await Promise.all([
		driver.inspect({ node, keys }, signal),
		tmux?.inventory(signal) ?? []
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
	if (tmux) await sweepCompletedTrackerSessions(store, { tmux, panes, node, now }, signal);
	return {
		sessions: [...sessions, ...direct],
		manual: panes.filter((pane) => pane.live && /^auto-[a-z0-9]{6,10}$/.test(pane.name))
	};
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

async function sweepCompletedTrackerSessions(
	store: TrackerPersistenceService,
	{
		tmux,
		panes,
		node,
		now
	}: {
		tmux: TrackerTmuxAdapter;
		panes: readonly WatchdogPane[];
		node: string;
		now: number;
	},
	signal: AbortSignal
): Promise<void> {
	for (const pane of panes) {
		signal.throwIfAborted();
		const run = completedTrackerPaneRun(store, pane, now);
		if (!run) continue;
		const token = trackerManagedToken(node, JSON.stringify([run.itemId, run.auto, run.attempt]));
		const closed = await tmux.closeIdle(
			{
				pane,
				cli: run.cli,
				attempt: run.sessionId === token ? token : undefined,
				stillComplete: () => {
					const current = completedTrackerPaneRun(store, pane, now);
					return (
						current?.id === run.id &&
						current.endedAt === run.endedAt &&
						current.sessionId === run.sessionId
					);
				}
			},
			signal
		);
		if (!closed) continue;
		const resume = run.cli === 'codex' ? 'codex resume --all' : 'claude --resume';
		store.appendLocal({
			itemId: run.itemId,
			fields: {
				'note+': `Closed idle tmux session ${pane.name} on ${store.node}. Resume in the original worktree and provider profile with \`${resume}\`.`
			}
		});
	}
}

function completedTrackerPaneRun(
	store: TrackerPersistenceService,
	pane: WatchdogPane,
	now: number
) {
	const match = runSessionName.exec(pane.name);
	if (!match || !pane.ready || pane.attached || !pane.runnerSocket) return undefined;
	const [, itemPrefix, runId] = match;
	const id = Number(runId);
	if (!Number.isSafeInteger(id)) return undefined;
	const run = readCompletedTrackerPaneRun(
		store,
		pane,
		{ id, itemPrefix },
		now - completedSessionGrace
	);
	if (!run) return undefined;
	const doneAt = trackerClockMilliseconds(run.statusClock ?? '');
	const idleFor = now - Math.max(doneAt, run.endedAt, pane.activity);
	return doneAt && idleFor >= completedSessionGrace ? run : undefined;
}

function readCompletedTrackerPaneRun(
	store: TrackerPersistenceService,
	pane: WatchdogPane,
	{ id, itemPrefix }: { id: number; itemPrefix: string },
	cutoff: number
) {
	return store.database
		.prepare(
			`SELECT r.id, r.item_id AS itemId, r.cli, r.auto_token AS auto,
		r.attempt, r.session_id AS sessionId, r.ended_at AS endedAt,
		json_extract(i.clocks, '$.status') AS statusClock
		FROM runs r JOIN items i ON i.id = r.item_id
		LEFT JOIN meta reservation ON reservation.k = 'harness_dispatch_run:' || r.id
		WHERE r.id = ? AND r.tmux = ? AND (r.item_id = ? OR substr(r.item_id, 1, 6) = ?)
		AND r.state = 'finished' AND r.started_at BETWEEN ? AND ? AND r.ended_at IS NOT NULL
		AND r.cli IN ('codex', 'claude') AND i.status = 'done' AND i.deleted = 0
		AND (i.needs_daniel = 0 OR i.resolved = 1)
		AND (r.watch_pane IS NULL OR r.watch_pane = ?)
		AND (coalesce(json_extract(reservation.v, '$.hostSessionId'), '') NOT GLOB '*:%*'
			OR json_extract(reservation.v, '$.hostSessionId') = ?)
		AND NOT EXISTS (
			SELECT 1 FROM runs other LEFT JOIN items owner ON owner.id = other.item_id
			WHERE other.id <> r.id AND (other.tmux = r.tmux OR other.session_name = r.tmux OR other.watch_pane = ?)
			AND (other.state <> 'finished' OR owner.status IS NOT 'done'
				OR (owner.needs_daniel = 1 AND owner.resolved = 0))
		)
		AND NOT EXISTS (
			SELECT 1 FROM meta link JOIN items owner ON owner.id = link.v
			WHERE link.k GLOB '${trackerSessionItemPrefix}' || r.id || ':*' AND owner.deleted = 0
			AND (owner.status IS NOT 'done' OR (owner.needs_daniel = 1 AND owner.resolved = 0)
				OR CAST(substr(json_extract(owner.clocks, '$.status'), 1, 15) AS INTEGER) > ?)
		)`
		)
		.get(
			id,
			pane.name,
			itemPrefix,
			itemPrefix,
			pane.createdAt - 1000,
			pane.createdAt + 60_000,
			pane.key,
			pane.key,
			pane.key,
			cutoff
		) as CompletedTrackerPaneRun | undefined;
}
