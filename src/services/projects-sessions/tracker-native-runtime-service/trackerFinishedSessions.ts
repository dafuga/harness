// @harness-uid u_bl6xl2h4a3
import { trackerManagedToken } from '../../../adapters/projects-sessions/tracker-tmux-adapter/trackerManagedLaunchReceipt';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { WatchdogPane } from '../WatchdogPaneService.types';
import { trackerSessionItemPrefix } from '../tracker-local-api-service/trackerLocalItemMutation';
import type { CompletedTrackerPaneRun, TrackerSessionSweep } from './trackerHostLaunch.types';

/** Time for a finishing session to print its last words; the scheduler ticks every few seconds. */
const finishedGrace = 30_000;
const quietGrace = 20_000;
/** A finished pane that never returns to an empty composer is closed once it has gone silent. */
const stuckGrace = 10 * 60_000;
const linkedWorkGrace = 15 * 60_000;
export const runSessionName = /^auto-([a-z0-9]{6,10})-r([1-9][0-9]*)$/;

/**
 * Close the tmux session of every finished run, whatever its outcome. Only the launcher's own
 * `auto-<item>-r<run>` names qualify, so control and deploy sessions are out of reach.
 */
export async function closeFinishedTrackerSessions(
	store: TrackerPersistenceService,
	sweep: TrackerSessionSweep,
	signal: AbortSignal
): Promise<void> {
	for (const pane of sweep.panes) {
		signal.throwIfAborted();
		const run = finishedPaneRun(store, pane, sweep.now);
		if (run) await closeRunSession(store, { ...sweep, pane, run }, signal);
	}
}

async function closeRunSession(
	store: TrackerPersistenceService,
	{
		tmux,
		node,
		now,
		pane,
		run
	}: TrackerSessionSweep & { pane: WatchdogPane; run: CompletedTrackerPaneRun },
	signal: AbortSignal
) {
	const quiet = now - pane.activity;
	if (quiet < quietGrace) return;
	const token = trackerManagedToken(node, JSON.stringify([run.itemId, run.auto, run.attempt]));
	const closed = await tmux.closeIdle(
		{
			pane,
			cli: run.cli,
			// A run that failed during startup has no recorded session to compare with.
			attempt: run.sessionId === token || run.sessionId === null ? token : undefined,
			force: quiet >= stuckGrace && now - run.endedAt >= stuckGrace,
			// A live background shell or monitor may still be needed until the item closes.
			keepBackground: !run.itemClosed,
			stillComplete: () => {
				const current = finishedPaneRun(store, pane, now);
				return current?.id === run.id && current.endedAt === run.endedAt;
			}
		},
		signal
	);
	if (!closed) return;
	const resume = run.cli === 'codex' ? 'codex resume --all' : 'claude --resume';
	store.appendLocal({
		itemId: run.itemId,
		fields: {
			'note+': `Closed finished run session ${pane.name} on ${store.node} (run #${run.id}: ${run.outcome}). Resume in the original worktree and provider profile with \`${resume}\`.`
		}
	});
}

function finishedPaneRun(store: TrackerPersistenceService, pane: WatchdogPane, now: number) {
	const match = runSessionName.exec(pane.name);
	if (!match || !pane.ready || pane.attached || !pane.runnerSocket) return undefined;
	const id = Number(match[2]);
	if (!Number.isSafeInteger(id)) return undefined;
	const run = readFinishedPaneRun(store, pane, { id, itemPrefix: match[1] }, now - finishedGrace);
	if (!run) return undefined;
	return linkedWorkActive(store, pane, id, now) ? undefined : run;
}

export function linkedWorkActive(
	store: TrackerPersistenceService,
	pane: WatchdogPane,
	runId: number,
	now: number
): boolean {
	return now - pane.activity < linkedWorkGrace && hasActiveLinkedItem(store, runId);
}

/** `tracker start` from inside a run links more work to its pane. */
function hasActiveLinkedItem(store: TrackerPersistenceService, runId: number): boolean {
	return Boolean(
		store.database
			.prepare(
				`SELECT 1 FROM meta link JOIN items owner ON owner.id = link.v
			WHERE link.k GLOB ? AND owner.deleted = 0 AND owner.status = 'in_progress'
			AND (owner.needs_daniel = 0 OR owner.resolved = 1) AND owner.chief_review IS NULL`
			)
			.get(`${trackerSessionItemPrefix}${runId}:*`)
	);
}

function readFinishedPaneRun(
	store: TrackerPersistenceService,
	pane: WatchdogPane,
	{ id, itemPrefix }: { id: number; itemPrefix: string },
	endedBefore: number
) {
	return store.database
		.prepare(
			`SELECT r.id, r.item_id AS itemId, r.cli, r.outcome, r.auto_token AS auto,
		r.attempt, r.session_id AS sessionId, r.ended_at AS endedAt,
		(i.deleted = 1 OR coalesce(i.status, '') IN ('done', 'ignored')) AS itemClosed
		FROM runs r JOIN items i ON i.id = r.item_id
		LEFT JOIN meta reservation ON reservation.k = 'harness_dispatch_run:' || r.id
		WHERE r.id = ? AND (r.tmux = ? OR (r.tmux IS NULL AND r.started_at IS NULL))
		AND (r.item_id = ? OR substr(r.item_id, 1, 6) = ?)
		AND r.state = 'finished' AND r.ended_at <= ? AND r.cli IN ('codex', 'claude')
		AND NOT (
			coalesce(r.outcome,'') = 'blocked' AND coalesce(i.status,'') = 'blocked'
			AND coalesce(i.auto = r.auto_token, 0)
			AND i.resolved = 1 AND i.needs_daniel = 0 AND i.chief_review IS NULL
			AND coalesce(json_extract(i.clocks,'$.answer'),'') > coalesce(json_extract(i.clocks,'$.question'),'')
			AND coalesce(json_extract(i.clocks,'$.answer'),'') > coalesce(json_extract(i.clocks,'$.status'),'')
		)
		AND (r.started_at IS NULL OR r.started_at BETWEEN ? AND ?)
		AND (r.watch_pane IS NULL OR r.watch_pane = ?)
		AND (coalesce(json_extract(reservation.v, '$.hostSessionId'), '') NOT GLOB '*:%*'
			OR json_extract(reservation.v, '$.hostSessionId') = ?)
		AND NOT EXISTS (
			SELECT 1 FROM runs other
			WHERE other.id <> r.id AND other.state <> 'finished'
			AND (other.tmux = ? OR other.session_name = ? OR other.watch_pane = ?)
		)`
		)
		.get(
			id,
			pane.name,
			itemPrefix,
			itemPrefix,
			endedBefore,
			pane.createdAt - 1000,
			pane.createdAt + 60_000,
			pane.key,
			pane.key,
			pane.name,
			pane.name,
			pane.key
		) as CompletedTrackerPaneRun | undefined;
}
