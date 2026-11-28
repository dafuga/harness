// @harness-uid u_bl6xl2h4a3
import { createHash } from 'node:crypto';
import { trackerStoredSchedulingHold } from '../../../repositories/projects-sessions/tracker-dispatch-repository/dispatchItemFields';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { WatchdogPaneService } from '../WatchdogPaneService';
import type {
	WatchdogItem,
	WatchdogPane,
	WatchdogRun,
	WatchdogScan
} from '../WatchdogPaneService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { handoffRunOwnership } from './trackerHostWatchdogState';
import { contextAlert } from './trackerHostWatchdogAlerts';
import { sessionHealthInterval } from './trackerSessionHealth';
import { trackerContextCheckpointPrefix } from './trackerWatchdogContext';
import type { TrackerHandoffAttempt, TrackerHandoffTarget } from './trackerWatchdogContext.types';
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';

const contextLimit = 150_000;
const panes = new WatchdogPaneService();

export async function trackerContextHandoffs(
	store: TrackerPersistenceService,
	driver: TrackerWatchdogPort,
	scan: WatchdogScan & { canRelaunch?: boolean },
	signal: AbortSignal
): Promise<Set<string>> {
	const items = new TrackerItemReadRepository(store.database);
	const handled = new Set<string>();
	for (const pane of scan.panes) {
		const target = handoffTarget(store, scan, pane);
		if (!target) continue;
		handled.add(pane.key);
		await progressHandoff(
			{ store, driver, items, now: scan.now, canRelaunch: scan.canRelaunch },
			target,
			signal
		);
	}
	return handled;
}

function handoffTarget(
	store: TrackerPersistenceService,
	scan: WatchdogScan,
	pane: WatchdogPane
): TrackerHandoffTarget | undefined {
	if (!pane.live) return undefined;
	const run = scan.runs.find((candidate) => panes.matchesRun(pane, candidate));
	const row = run
		? scan.items.find(({ id }) => id === run.itemId)
		: panes.manualItem(pane, scan.items);
	if (!handoffEligible(row)) return undefined;
	const requested =
		Number(store.getMeta(handoffKey(pane))) || checkpointStart(row, pane, run, scan.host);
	if ((pane.contextTokens ?? 0) <= contextLimit && !requested) return undefined;
	return { pane, id: row.id, requested, runId: run?.id };
}

function checkpointStart(
	row: WatchdogItem,
	pane: WatchdogPane,
	run: WatchdogRun | undefined,
	host: string
) {
	if (!run) return 0;
	const startedAt = Math.max(pane.createdAt, run.startedAt ?? 0, run.resumedAt ?? 0);
	return row.notes?.some(
		({ node, at, text }) => node === host && at >= startedAt && isContextCheckpoint(text)
	)
		? startedAt
		: 0;
}

function isContextCheckpoint(text: string): boolean {
	const prefix = trackerContextCheckpointPrefix;
	return text.toLowerCase().startsWith(prefix) && text.slice(prefix.length).trim().length > 8;
}

function handoffEligible(row?: WatchdogItem): row is WatchdogItem {
	return (
		row?.status === 'in_progress' && !row.deleted && (!row.needsDaniel || row.resolved === true)
	);
}

function handoffKey(pane: WatchdogPane) {
	return 'tracker_watchdog_context:' + createHash('sha256').update(pane.key).digest('hex');
}

function handoffReady(item: TrackerItem, requested: number, node: string, now: number): boolean {
	return (
		item.status === 'in_progress' &&
		!item.deleted &&
		!trackerStoredSchedulingHold(item, now) &&
		item.notes_log.some(
			({ at, text, node: author }) =>
				author === node && Date.parse(at) >= requested && isContextCheckpoint(text)
		)
	);
}

async function progressHandoff(
	{
		store,
		driver,
		items,
		now,
		canRelaunch
	}: {
		store: TrackerPersistenceService;
		driver: TrackerWatchdogPort;
		items: TrackerItemReadRepository;
		now: number;
		canRelaunch?: boolean;
	},
	target: TrackerHandoffTarget,
	signal: AbortSignal
) {
	const { pane, id, requested } = target;
	const attempt =
		canRelaunch &&
		!trackerStoredSchedulingHold(items.getStored(id), now) &&
		handoffAttempt(store, target, now);
	const alert = (detail: string) => contextAlert(store, target, now, detail);
	if (!attempt || !driver.close) {
		alert('Chief of Staff can arrange a handoff when the pane is safe to pause.');
		return;
	}
	if (!requested) {
		const confirmed = await requestHandoff(
			store,
			driver,
			{ pane, id, cli: attempt.cli, now },
			signal
		);
		alert(
			confirmed ? 'Requested a handoff note.' : 'Handoff prompt submission could not be verified.'
		);
		return;
	}
	await finishHandoff({ store, driver, items, now }, { target, attempt }, signal);
}

async function finishHandoff(
	{
		store,
		driver,
		items,
		now
	}: {
		store: TrackerPersistenceService;
		driver: TrackerWatchdogPort;
		items: TrackerItemReadRepository;
		now: number;
	},
	{ target, attempt }: { target: TrackerHandoffTarget; attempt: TrackerHandoffAttempt },
	signal: AbortSignal
) {
	const { id, pane, requested } = target;
	const ready = () => handoffReady(items.getStored(id), requested, store.node, now);
	const stillComplete = () => {
		const current = handoffRunOwnership(store, { id, runId: attempt.runId, pane });
		return Boolean(
			current && current.token === attempt.token && current.observed === attempt.observed && ready()
		);
	};
	if (!stillComplete()) {
		const overdue = now - requested >= 3 * sessionHealthInterval && !ready();
		contextAlert(
			store,
			target,
			now,
			overdue
				? 'The handoff note is overdue. Chief of Staff should inspect the idle pane.'
				: 'Waiting for the handoff note before relaunch.'
		);
		return;
	}
	if (
		await driver.close?.(
			{
				pane,
				cli: attempt.cli,
				attempt: attempt.token,
				observed: attempt.observed,
				stillComplete
			},
			signal
		)
	)
		contextAlert(
			store,
			target,
			now,
			'Saved the handoff and closed the idle pane. Tracker will request a fresh session.'
		);
}

function handoffAttempt(
	store: TrackerPersistenceService,
	{ pane, id, runId }: TrackerHandoffTarget,
	now: number
): TrackerHandoffAttempt | undefined {
	if (!runId || pane.attached || now - pane.activity < sessionHealthInterval) return undefined;
	const cli = panes.idlePrompt(pane);
	const ownership = handoffRunOwnership(store, { id, runId, pane });
	return cli && ownership ? { cli, runId, ...ownership } : undefined;
}

async function requestHandoff(
	store: TrackerPersistenceService,
	driver: TrackerWatchdogPort,
	{ pane, id, cli, now }: { pane: WatchdogPane; id: string; cli: 'codex' | 'claude'; now: number },
	signal: AbortSignal
): Promise<boolean> {
	const key = handoffKey(pane);
	store.writeMeta({ [key]: String(now) });
	const message = `Save a short checkpoint using tracker note ${id} with a note starting "${trackerContextCheckpointPrefix}". Include completed work, the exact worktree and branch, pending checks and the next step. Leave the item in progress and pause at the idle prompt. Tracker will continue the same item with the same model in a fresh session. Preserve the worktree.`;
	return driver.nudge({ pane, cli, message, id: key, itemId: id }, signal);
}
