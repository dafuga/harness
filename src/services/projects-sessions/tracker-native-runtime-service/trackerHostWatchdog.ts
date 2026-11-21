// @harness-uid u_bl6xl2h4a3
import { createHash } from 'node:crypto';
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { WatchdogIdleService } from '../WatchdogIdleService';
import { WatchdogPaneService } from '../WatchdogPaneService';
import { WatchdogStartupService } from '../WatchdogStartupService';
import type { IdleDecision } from '../WatchdogIdleService.types';
import type { WatchdogPane, WatchdogScan } from '../WatchdogPaneService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { recordStartupAlerts, recordWatchdogAlert } from './trackerHostWatchdogAlerts';
import { sendWatchdogAlerts } from './trackerHostCos';
import type { TrackerHostEffects } from './nativeTrackerHostEffects.types';
import { localWatchdogRuns, readWatchdogAlerts, watchdogItem } from './trackerHostWatchdogState';
import { trackerWatchdogPort } from './trackerWatchdogPort';
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';

const minute = 60_000;
const nudge =
	'Tracker watchdog check-in. Continue the current task, or record the exact blocker on the Tracker item.';

export function trackerHostWatchdog(
	store: TrackerPersistenceService,
	config: NonNullable<TrackerHostEffects['watchdog']>,
	now: () => number
) {
	const driver = trackerWatchdogPort(config, store.node);
	const items = new TrackerItemReadRepository(store.database);
	const idle = new WatchdogIdleService();
	const startup = new WatchdogStartupService();
	const paneService = new WatchdogPaneService();
	const chiefOfStaff = config.chiefOfStaff === true && store.node === 'daniel-primary-mbp';
	let lastCosPoll = -Infinity;
	const alerts = () =>
		Object.values(readWatchdogAlerts(store)).filter(({ item_id }) =>
			activeWatchdogItem(items, item_id)
		);
	return {
		alerts,
		chiefOfStaff,
		async inspect(id: string | null, signal: AbortSignal) {
			const panes = await driver.scan(signal);
			if (!panes) return { computer: store.node, available: false, sessions: [], recovery: [] };
			const snapshot = watchdogSnapshot(store, items, panes, now());
			const itemId = id ? items.resolve(id).id : undefined;
			return {
				computer: store.node,
				available: true,
				sessions: idle.plan({ ...snapshot, itemId }).actions,
				recovery: []
			};
		},
		async tick(signal: AbortSignal) {
			const panes = await driver.scan(signal);
			signal.throwIfAborted();
			if (!panes) return;
			const snapshot = watchdogSnapshot(store, items, panes, now());
			recordStartupAlerts(store, snapshot, startup);
			for (const decision of idle.plan(snapshot).actions) {
				const pane = panes.find(({ key }) => key === decision.paneKey);
				const item = activeWatchdogItem(items, decision.id);
				if (!pane || !idleWatchdogItem(item)) continue;
				if (paneService.idlePrompt(pane) !== decision.cli) continue;
				await applyIdleDecision({ store, driver, snapshot }, { decision, pane }, signal);
			}
			if (chiefOfStaff && now() - lastCosPoll >= minute) {
				lastCosPoll = now();
				await sendWatchdogAlerts(store, driver, alerts(), signal);
			}
		}
	};
}

function watchdogSnapshot(
	store: TrackerPersistenceService,
	items: TrackerItemReadRepository,
	panes: readonly WatchdogPane[],
	now: number
): WatchdogScan {
	const allItems = items.list({ status: 'all', limit: -1 }).map(watchdogItem);
	const runs = localWatchdogRuns(store);
	for (const pane of panes) {
		const run = runs.find(
			(candidate) => candidate.tmux === pane.name || candidate.watchPane === pane.key
		);
		if (!run) continue;
		const seen = Number(store.getMeta(paneNudgeKey(pane)) ?? 0);
		if (seen > (run.idleNudgedAt ?? 0)) {
			run.idleNudgedAt = seen;
			run.idleNudges = 1;
		}
	}
	return { panes, runs, items: allItems, now, host: store.node };
}

async function applyIdleDecision(
	{
		store,
		driver,
		snapshot
	}: {
		store: TrackerPersistenceService;
		driver: TrackerWatchdogPort;
		snapshot: WatchdogScan;
	},
	{ decision, pane }: { decision: IdleDecision; pane: WatchdogPane },
	signal: AbortSignal
): Promise<void> {
	signal.throwIfAborted();
	const key = paneNudgeKey(pane);
	const previous = Number(store.getMeta(key) ?? 0);
	if (previous && snapshot.now - previous < 10 * minute) return;
	if (decision.action === 'alert' || previous) {
		const reason =
			decision.reason ?? `Session ${pane.name} is idle again after a watchdog check-in.`;
		recordWatchdogAlert(
			store,
			{ itemId: decision.id, kind: 'idle', reason, identity: pane.key },
			snapshot.now
		);
		return;
	}
	// A lost acknowledgement must not send the same input twice.
	store.writeMeta({ [key]: String(snapshot.now) });
	const { name, activity, createdAt, x, y } = pane;
	const sent = await driver.nudge(
		{
			id: key,
			itemId: decision.id,
			cli: decision.cli,
			message: nudge,
			pane: { key: pane.key, name, activity, createdAt, x, y }
		},
		signal
	);
	if (sent)
		store.appendLocal({
			itemId: decision.id,
			fields: { 'note+': `watchdog nudge 1/1 sent to ${pane.name} on ${store.node}` }
		});
}

function activeWatchdogItem(items: TrackerItemReadRepository, id: string): TrackerItem | undefined {
	try {
		const item = items.getStored(id);
		if (!item.deleted && item.status !== 'done' && item.status !== 'ignored') return item;
	} catch {
		return undefined;
	}
	return undefined;
}

function idleWatchdogItem(item?: TrackerItem): boolean {
	return item?.status === 'in_progress' && (!item.needs_daniel || item.resolved);
}

function paneNudgeKey({ key }: WatchdogPane): string {
	return 'tracker_host_watchdog_nudge:' + createHash('sha256').update(key).digest('hex');
}
