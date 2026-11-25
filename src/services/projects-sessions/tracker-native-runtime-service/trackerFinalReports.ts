// @harness-uid u_bl6xl2h4a3
import { dispatchRunRows } from '../../../repositories/projects-sessions/tracker-dispatch-repository/dispatchRunRows';
import type { TrackerDispatcherService } from '../../agents-providers/TrackerDispatcherService';
import {
	canonicalNode,
	finalReportPrefix
} from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { WatchdogPaneService } from '../WatchdogPaneService';
import { paneBackgroundWork } from '../watchdog-pane-service/paneBackgroundWork';
import type {
	WatchdogItem,
	WatchdogNote,
	WatchdogPane,
	WatchdogRun,
	WatchdogScan
} from '../WatchdogPaneService.types';

import type { TrackerFinalReport, TrackerReportSession } from './trackerFinalReports.types';

const reportIdle = 15 * 60_000;
const panes = new WatchdogPaneService();
/** The watchdog's own context handoff closes its pane itself and asks for a fresh session. */
const watchdogHandoff = /^stopped: watchdog context handoff/i;
const contextHandoff = /\bcontext (?:hand-?off|limit)\b|\b150(?:,000|k)\b/i;

/**
 * Finish runs whose session has waited at its composer with a final report. Returns their pane
 * keys so the idle check-in leaves them alone.
 */
export async function finishReportedRuns(
	store: TrackerPersistenceService,
	dispatch: TrackerDispatcherService,
	{ scan, skip }: { scan: WatchdogScan; skip: ReadonlySet<string> },
	signal: AbortSignal
): Promise<Set<string>> {
	const finished = new Set<string>();
	for (const run of scan.runs.filter(({ state }) => state === 'running')) {
		signal.throwIfAborted();
		const pane = scan.panes.find((candidate) => panes.matchesRun(candidate, run));
		const item = scan.items.find(({ id }) => id === run.itemId);
		if (!pane || !item || skip.has(pane.key) || !waitingSince(scan.now, pane, run)) continue;
		const report = finalReport(item, { pane, run, host: scan.host });
		if (!report) continue;
		const node = canonicalNode(store.node, {});
		const receipt = dispatchRunRows(store.database, node, item.id).find(
			(candidate) => candidate.node === node && candidate.id === run.id
		);
		if (!receipt) continue;
		const result = await dispatch.record(item.id, receipt, { type: 'final-report', ...report });
		if (result.status !== 'recorded') continue;
		finished.add(pane.key);
		store.appendLocal({
			itemId: item.id,
			fields: {
				'note+': `Tracker finished run #${run.id} (${report.outcome}) on ${store.node}. ${report.reason}`
			}
		});
	}
	return finished;
}

function waitingSince(now: number, pane: WatchdogPane, run: WatchdogRun): boolean {
	const latest = Math.max(pane.activity, run.startedAt ?? 0, run.resumedAt ?? 0);
	return (
		!pane.attached &&
		now - latest > reportIdle &&
		panes.idlePrompt(pane) === run.cli &&
		!paneBackgroundWork(pane)
	);
}

function stillOpen({ deleted, status }: WatchdogItem): boolean {
	return !deleted && (status === 'open' || status === 'in_progress');
}

function finalReport(
	item: WatchdogItem,
	session: TrackerReportSession
): TrackerFinalReport | undefined {
	if (!stillOpen(item)) return undefined;
	if (item.needsDaniel && !item.resolved)
		return { outcome: 'blocked', reason: item.question ?? 'Waiting on an unanswered question' };
	const { pane, run, host } = session;
	const since = run.resumedAt ?? run.startedAt ?? pane.createdAt;
	const notes = (item.notes ?? []).filter((note) => note.node === host && note.at >= since);
	const stop = notes.filter(({ text }) => /^stopped:/i.test(text)).at(-1);
	return stop ? stopReport(stop.text) : checkInReport(notes, session);
}

/** A session that answered the one check-in and went quiet again has said all it will say. */
function checkInReport(
	notes: readonly WatchdogNote[],
	{ pane, host }: TrackerReportSession
): TrackerFinalReport | undefined {
	const nudge = `watchdog nudge 1/1 sent to ${pane.name} on ${host}`;
	if (!notes.some(({ text, at }) => text === nudge && pane.activity > at + 1000)) return undefined;
	return {
		outcome: 'abandoned',
		reason: `${finalReportPrefix} idle at the composer again after the watchdog check-in`
	};
}

function stopReport(text: string): TrackerFinalReport | undefined {
	if (watchdogHandoff.test(text)) return undefined;
	return {
		outcome: 'abandoned',
		reason: contextHandoff.test(text)
			? 'Handed off at the context limit and idle at the composer'
			: `${finalReportPrefix} idle at the composer after its stopped note`
	};
}
