// @harness-uid u_bl6xl2h4a3
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { WatchdogIdleService } from '../WatchdogIdleService';
import { WatchdogPaneService } from '../WatchdogPaneService';
import { WatchdogStartupService } from '../WatchdogStartupService';
import type { WatchdogPane, WatchdogScan } from '../WatchdogPaneService.types';
import type { TrackerNativeRuntimeService } from '../TrackerNativeRuntimeService';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { recordStartupAlerts } from './trackerHostWatchdogAlerts';
import { applyIdleDecision, paneNudgeKey } from './trackerHostWatchdogIdle';
import { sendWatchdogAlerts } from './trackerHostCos';
import type { TrackerHostEffects } from './nativeTrackerHostEffects.types';
import {
	finishObservedRuns,
	localWatchdogRuns,
	readWatchdogAlerts,
	watchdogItem
} from './trackerHostWatchdogState';
import {
	applyTrackerSessionHealth,
	readTrackerSessionHealth,
	recheckTrackerRecovery,
	trackerRecoveryLaunch
} from './trackerSessionHealthRuntime';
import { sessionHealthInterval } from './trackerSessionHealth';
import type { TrackerWatchdogLaunch } from './trackerSessionHealth.types';
import { trackerContextHandoffs } from './trackerContextHandoff';
import { sampleTrackerContexts } from './trackerWatchdogContext';
import { trackerTranscriptScan } from './trackerTranscriptScan';
import { trackerWatchdogPort } from './trackerWatchdogPort';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';

const minute = 60_000;

export function trackerHostWatchdog(
	store: TrackerPersistenceService,
	config: NonNullable<TrackerHostEffects['watchdog']>,
	now: () => number,
	launch?: TrackerWatchdogLaunch
) {
	const driver = trackerWatchdogPort(config, store.node);
	const scanTranscripts = trackerTranscriptScan(store, config.transcriptRoots ?? [], now);
	const items = new TrackerItemReadRepository(store.database);
	const chiefOfStaff = config.chiefOfStaff === true && store.node === 'daniel-primary-mbp';
	let lastCosPoll = -Infinity;
	let lastHealthPoll = -Infinity;
	let peerAlerts: readonly TrackerWatchdogAlert[] = [];
	const readItems = () => items.list({ status: 'all', limit: -1 });
	const alerts = () => [...localAlerts(store, items), ...peerAlerts];
	return {
		alerts,
		chiefOfStaff,
		async inspect(id: string | null, signal: AbortSignal) {
			const panes = await driver.scan(signal);
			if (!panes) return { computer: store.node, available: false, sessions: [], recovery: [] };
			const rows = readItems();
			const snapshot = watchdogSnapshot(store, rows, panes, now());
			const itemId = id ? items.resolve(id).id : undefined;
			return {
				computer: store.node,
				available: true,
				sessions: new WatchdogIdleService().plan({ ...snapshot, itemId }).actions,
				startup: new WatchdogStartupService().plan({ ...snapshot, itemId }).actions,
				recovery: readTrackerSessionHealth(store, rows, panes, snapshot.now).filter(
					(issue) => !itemId || itemId === issue.item_id
				)
			};
		},
		async tick(signal: AbortSignal) {
			if (config.transcriptRoots?.length) await scanTranscripts(signal);
			if (now() - lastHealthPoll >= sessionHealthInterval) {
				lastHealthPoll = now();
				await scanHostSessions(
					{ store, items, driver },
					{ readItems, now, launch, roots: config.transcriptRoots },
					signal
				);
			}
			if (chiefOfStaff && now() - lastCosPoll >= minute) {
				lastCosPoll = now();
				peerAlerts = (await driver.peers?.(signal)) ?? peerAlerts;
				await sendWatchdogAlerts(store, driver, alerts(), signal);
			}
		}
	};
}

export function configuredHostWatchdog(
	{ store, now, dispatch }: Pick<TrackerNativeRuntimeService, 'store' | 'now' | 'dispatch'>,
	watchdog?: TrackerHostEffects['watchdog']
) {
	if (watchdog) return trackerHostWatchdog(store, watchdog, now, trackerRecoveryLaunch(dispatch));
	return undefined;
}

function localAlerts(store: TrackerPersistenceService, items: TrackerItemReadRepository) {
	return Object.values(readWatchdogAlerts(store)).filter(
		({ item_id, kind }) =>
			kind === 'orphan' || kind === 'finished' || activeWatchdogItem(items, item_id)
	);
}

async function scanHostSessions(
	hosts: {
		store: TrackerPersistenceService;
		items: TrackerItemReadRepository;
		driver: TrackerWatchdogPort;
	},
	options: {
		readItems: () => readonly TrackerItem[];
		now: () => number;
		launch?: TrackerWatchdogLaunch;
		roots?: readonly string[];
	},
	signal: AbortSignal
) {
	const inventory = await hosts.driver.scan(signal);
	signal.throwIfAborted();
	if (!inventory) return;
	const panes = await sampleTrackerContexts(inventory, options.roots ?? [], signal);
	const rows = options.readItems();
	const snapshot = watchdogSnapshot(hosts.store, rows, panes, options.now());
	await inspectHostSessions(hosts, { rows, snapshot, launch: options.launch }, signal);
}

async function inspectHostSessions(
	{
		store,
		items,
		driver
	}: {
		store: TrackerPersistenceService;
		items: TrackerItemReadRepository;
		driver: TrackerWatchdogPort;
	},
	{
		rows,
		snapshot,
		launch
	}: { rows: readonly TrackerItem[]; snapshot: WatchdogScan; launch?: TrackerWatchdogLaunch },
	signal: AbortSignal
) {
	recordStartupAlerts(store, snapshot, new WatchdogStartupService());
	const plan = new WatchdogIdleService().plan(snapshot);
	finishObservedRuns(store, plan.abandonRunIds, snapshot.now);
	await applyTrackerSessionHealth(
		store,
		readTrackerSessionHealth(store, rows, snapshot.panes, snapshot.now),
		{
			now: snapshot.now,
			items: rows,
			launch:
				launch &&
				((item) => recheckTrackerRecovery({ store, driver, signal }, item, launch, snapshot.now))
		},
		signal
	);
	const handoffs = await trackerContextHandoffs(
		store,
		driver,
		{ ...snapshot, canRelaunch: Boolean(launch) },
		signal
	);
	const paneService = new WatchdogPaneService();
	for (const decision of plan.actions) {
		const pane = snapshot.panes.find(({ key }) => key === decision.paneKey);
		if (
			!pane ||
			handoffs.has(pane.key) ||
			!idleWatchdogItem(activeWatchdogItem(items, decision.id))
		)
			continue;
		if (paneService.idlePrompt(pane) !== decision.cli) continue;
		await applyIdleDecision({ store, driver, snapshot }, { decision, pane }, signal);
	}
}

function watchdogSnapshot(
	store: TrackerPersistenceService,
	items: readonly TrackerItem[],
	panes: readonly WatchdogPane[],
	now: number
): WatchdogScan {
	const allItems = items.map(watchdogItem);
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
