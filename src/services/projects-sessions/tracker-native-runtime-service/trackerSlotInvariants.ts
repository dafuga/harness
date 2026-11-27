// @harness-uid u_bl6xl2h4a3
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { WatchdogPaneService } from '../WatchdogPaneService';
import { paneBackgroundWork } from '../watchdog-pane-service/paneBackgroundWork';
import type { WatchdogPane } from '../WatchdogPaneService.types';
import { occupiedHostRuns } from './trackerHostAdmission';
import type { TrackerOccupiedRun } from './trackerHostAdmission.types';
import { linkedWorkActive, runSessionName } from './trackerFinishedSessions';
import type { TrackerSessionHealthIssue } from './trackerSessionHealth.types';
import type {
	TrackerLeftoverPane,
	TrackerSlotHolder,
	TrackerSlotRun,
	TrackerSlotState
} from './trackerSlotInvariants.types';

const minute = 60_000;
/** A finished run may keep its pane this long before the watchdog calls it a leak. */
const finishedLimit = 5 * minute;
/** A running run may wait at its empty composer this long. */
const idleLimit = 15 * minute;
/** Control and deploy sessions are never launcher leftovers. */
const protectedName = /^(?:cos|credential-broker-mac|rng-poker-keeper|deploy-.+)$/;
export const slotAlertKinds: ReadonlySet<string> = new Set(['finished-run-pane', 'idle-run']);

const decisions = new WatchdogPaneService();

/**
 * Check this computer's runs against its live panes, whatever each item's status. Read only:
 * closing panes and finishing runs stay with the launcher.
 */
export function readTrackerSlotState(
	store: TrackerPersistenceService,
	panes: readonly WatchdogPane[],
	{ now, cap }: { now: number; cap: number | null }
): TrackerSlotState {
	const state: TrackerSlotState = {
		report: { computer: store.node, cap, held: [], leftover: [] },
		violations: []
	};
	if (!hasRuns(store)) return state;
	for (const pane of panes) {
		if (pane.live && !protectedName.test(pane.name)) inspectFinishedPane(store, state, pane, now);
	}
	for (const run of occupiedHostRuns(store))
		inspectSlot(store, state, { run, pane: runPane(panes, run), now });
	return state;
}

function hasRuns({ database }: TrackerPersistenceService): boolean {
	return Boolean(
		database.prepare("SELECT 1 FROM sqlite_schema WHERE name = 'runs' AND type = 'table'").get()
	);
}

function inspectFinishedPane(
	store: TrackerPersistenceService,
	{ report, violations }: TrackerSlotState,
	pane: WatchdogPane,
	now: number
) {
	const run = finishedRun(store, pane);
	if (!run) return;
	const kept = keptReason(store, pane, { run, now });
	const overdue = now - run.endedAt > finishedLimit;
	const age = now - run.endedAt;
	const lingering = overdue
		? `still live ${minutes(age)}m after the run finished`
		: 'closing grace';
	const entry: TrackerLeftoverPane = {
		run: run.id,
		item: run.itemId,
		session: pane.name,
		why: `${kept ?? lingering}; item ${itemState(run)}`
	};
	report.leftover.push(entry);
	if (kept || !overdue) return;
	violations.push({
		item_id: run.itemId,
		host: report.computer,
		kind: 'finished-run-pane',
		session: pane.name,
		// The item's status is left to the slot summary: a reason that changes resends the alert.
		reason: `Session ${pane.name} is still live more than 5 minutes after run #${run.id} finished (${run.outcome ?? 'no outcome'}). It holds no launcher slot.`,
		identity: `${run.id}:${pane.key}`
	});
}

/** The keep-alive exceptions the launcher's own pane closer honours. */
function keptReason(
	store: TrackerPersistenceService,
	pane: WatchdogPane,
	{ run, now }: { run: TrackerSlotRun; now: number }
): string | null {
	if (pane.attached) return 'kept: someone is attached';
	if (!itemClosed(run) && paneBackgroundWork(pane))
		return 'kept: live background work for an open item';
	if (linkedWorkActive(store, pane, run.id, now)) return 'kept: active work on a linked item';
	return null;
}

function finishedRun(
	store: TrackerPersistenceService,
	pane: WatchdogPane
): TrackerSlotRun | undefined {
	const [, prefix = '', id = '0'] = runSessionName.exec(pane.name) ?? [];
	const busy = store.database
		.prepare(
			`SELECT 1 FROM runs WHERE state <> 'finished'
			AND (tmux = ? OR session_name = ? OR watch_pane = ?)`
		)
		.get(pane.name, pane.name, pane.key);
	if (busy) return undefined;
	const run = store.database
		.prepare(
			`SELECT r.id, r.item_id AS itemId, r.ended_at AS endedAt, r.outcome, i.status, i.deleted
		FROM runs r LEFT JOIN items i ON i.id = r.item_id
		WHERE r.state = 'finished' AND r.ended_at IS NOT NULL AND (r.watch_pane = ? OR (
			r.id = ? AND (r.tmux = ? OR (r.tmux IS NULL AND r.started_at IS NULL))
			AND (r.item_id = ? OR substr(r.item_id, 1, 6) = ?)))
		ORDER BY r.ended_at DESC LIMIT 1`
		)
		.get(pane.key, Number(id), pane.name, prefix, prefix) as TrackerSlotRun | undefined;
	// A pane created after the run ended is somebody's new session under an old name.
	return run && pane.createdAt <= run.endedAt + minute ? run : undefined;
}

function runPane(panes: readonly WatchdogPane[], run: TrackerOccupiedRun) {
	return panes.find((pane) => pane.live && (pane.name === run.tmux || pane.key === run.watchPane));
}

function inspectSlot(
	store: TrackerPersistenceService,
	{ report, violations }: TrackerSlotState,
	{ run, pane, now }: { run: TrackerOccupiedRun; pane?: WatchdogPane; now: number }
) {
	const idle = idleFor(store, { run, pane, now });
	const holder: TrackerSlotHolder = {
		run: run.id,
		item: run.itemId,
		state: run.state,
		session: run.tmux,
		why: `${slotActivity({ run, pane, now }, idle)}; item ${itemState(run)}`
	};
	report.held.push(holder);
	if (!pane || idle === null || idle <= idleLimit) return;
	const issue: TrackerSessionHealthIssue = {
		item_id: run.itemId,
		host: report.computer,
		kind: 'idle-run',
		session: pane.name,
		reason: `Run #${run.id} is still running but ${pane.name} has been idle at its composer for more than 15 minutes. It holds a launcher slot.`,
		identity: `${run.id}:${pane.key}`
	};
	violations.push(issue);
}

/** Milliseconds at the empty composer, or null when the session is not simply waiting. */
function idleFor(
	store: TrackerPersistenceService,
	{ run, pane, now }: { run: TrackerOccupiedRun; pane?: WatchdogPane; now: number }
): number | null {
	if (run.state !== 'running' || !pane || pane.attached) return null;
	if (decisions.idlePrompt(pane) !== run.cli) return null;
	if (!itemClosed(run) && paneBackgroundWork(pane)) return null;
	if (linkedWorkActive(store, pane, run.id, now)) return null;
	return now - Math.max(pane.activity, run.startedAt ?? 0, run.resumedAt ?? 0);
}

function slotActivity(
	{ run, pane, now }: { run: TrackerOccupiedRun; pane?: WatchdogPane; now: number },
	idle: number | null
): string {
	if (run.state === 'queued') return 'dispatched and starting';
	if (run.state === 'verifying') return 'verifying';
	if (!pane) return 'no live tmux session seen';
	if (idle !== null) return `idle at the composer ${minutes(idle)}m`;
	if (pane.attached) return 'someone is attached';
	if (paneBackgroundWork(pane)) return 'background work running';
	return `session live, last output ${minutes(now - pane.activity)}m ago`;
}

function itemClosed({ status, deleted }: { status: string | null; deleted: number | null }) {
	return deleted === 1 || status === 'done' || status === 'ignored';
}

function itemState(run: {
	status: string | null;
	deleted: number | null;
	waiting?: number | null;
}) {
	if (run.deleted === 1) return 'deleted';
	return `${run.status ?? 'unknown'}${run.waiting ? ', waiting on Daniel' : ''}`;
}

function minutes(milliseconds: number): number {
	return Math.max(0, Math.floor(milliseconds / minute));
}
