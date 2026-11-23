// @harness-uid u_bl6xl2h4a3
import { createHash } from 'node:crypto';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { WatchdogPaneService } from '../WatchdogPaneService';
import type { WatchdogItem, WatchdogPane, WatchdogScan } from '../WatchdogPaneService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { trackerSessionItemPrefix } from '../tracker-local-api-service/trackerLocalItemMutation';
import { recordWatchdogAlert } from './trackerHostWatchdogAlerts';
import { sessionHealthInterval } from './trackerSessionHealth';
import type { TrackerHandoffAttempt, TrackerHandoffTarget } from './trackerWatchdogContext.types';
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';

const contextLimit = 150_000;
const panes = new WatchdogPaneService();
const resumePrefix = 'stopped: watchdog context handoff; resume from:';

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
	const requested = Number(store.getMeta(handoffKey(pane)) ?? 0);
	if ((pane.contextTokens ?? 0) <= contextLimit && !requested) return undefined;
	const run = scan.runs.find((candidate) => panes.matchesRun(pane, candidate));
	const row = run
		? scan.items.find(({ id }) => id === run.itemId)
		: panes.manualItem(pane, scan.items);
	if (!handoffEligible(row)) return undefined;
	return { pane, id: row.id, requested, runId: run?.id };
}

function handoffEligible(row?: WatchdogItem): row is WatchdogItem {
	return (
		row?.status === 'in_progress' && !row.deleted && (!row.needsDaniel || Boolean(row.resolved))
	);
}

function handoffKey(pane: WatchdogPane) {
	return 'tracker_watchdog_context:' + createHash('sha256').update(pane.key).digest('hex');
}

function handoffReady(item: TrackerItem, requested: number, node: string): boolean {
	return (
		item.status === 'in_progress' &&
		!item.deleted &&
		!item.schedule_off &&
		(!item.needs_daniel || item.resolved) &&
		item.notes_log.some(
			({ at, text, node: author }) =>
				author === node &&
				Date.parse(at) >= requested &&
				text.toLowerCase().startsWith(resumePrefix) &&
				text.length > resumePrefix.length + 8
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
	const attempt = canRelaunch && handoffAttempt(store, target, now);
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
	const stillComplete = () =>
		ownedAttempt(store, { id, runId: attempt.runId, pane }) === attempt.token &&
		handoffReady(items.getStored(id), requested, store.node);
	if (!stillComplete()) {
		alert('Waiting for the handoff note before relaunch.');
		return;
	}
	if (await driver.close({ pane, cli: attempt.cli, attempt: attempt.token, stillComplete }, signal))
		alert('Saved the handoff and closed the idle pane. Tracker will request a fresh session.');
}

function handoffAttempt(
	store: TrackerPersistenceService,
	{ pane, id, runId }: TrackerHandoffTarget,
	now: number
): TrackerHandoffAttempt | undefined {
	if (!runId || pane.attached || now - pane.activity < sessionHealthInterval) return undefined;
	const cli = panes.idlePrompt(pane);
	const token = ownedAttempt(store, { id, runId, pane });
	return cli && token ? { cli, token, runId } : undefined;
}

function contextAlert(
	store: TrackerPersistenceService,
	{ pane, id }: TrackerHandoffTarget,
	now: number,
	detail: string
) {
	const reason = `Session ${pane.name} exceeded 150,000 active context tokens. ${detail}`;
	recordWatchdogAlert(
		store,
		{ itemId: id, session: pane.name, kind: 'context', reason, identity: pane.key },
		now,
		null
	);
}

function ownedAttempt(
	store: TrackerPersistenceService,
	{ id, runId, pane }: { id: string; runId: number; pane: WatchdogPane }
): string | undefined {
	const row = store.database
		.prepare(
			`SELECT session_id AS token FROM runs
		WHERE id = ? AND item_id = ? AND tmux = ? AND state = 'running'
		AND ABS(started_at - ?) <= 60000
		AND NOT EXISTS (
			SELECT 1 FROM meta link JOIN items owner ON owner.id = link.v
			WHERE link.k GLOB ? AND owner.deleted = 0 AND owner.status NOT IN ('done', 'ignored')
		)`
		)
		.get(runId, id, pane.name, pane.createdAt, `${trackerSessionItemPrefix}${runId}:*`) as
		| { token?: string }
		| undefined;
	return row?.token && /^[a-f0-9]{64}$/.test(row.token) ? row.token : undefined;
}

async function requestHandoff(
	store: TrackerPersistenceService,
	driver: TrackerWatchdogPort,
	{ pane, id, cli, now }: { pane: WatchdogPane; id: string; cli: 'codex' | 'claude'; now: number },
	signal: AbortSignal
): Promise<boolean> {
	const key = handoffKey(pane);
	store.writeMeta({ [key]: String(now) });
	const message = `Save a short Tracker handoff so the task can resume in a fresh session. Record completed work, the exact worktree and branch, pending checks and the next step using tracker note ${id} with a note starting "${resumePrefix}". Then pause at the prompt. Preserve the worktree.`;
	return driver.nudge({ pane, cli, message, id: key, itemId: id }, signal);
}
