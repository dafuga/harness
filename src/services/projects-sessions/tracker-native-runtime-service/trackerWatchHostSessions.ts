// @harness-uid u_bl6xl2h4a3
import { trackerStoredSchedulingHold } from '../../../repositories/projects-sessions/tracker-dispatch-repository/dispatchItemFields';
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerDispatcherService } from '../../agents-providers/TrackerDispatcherService';
import { finishReportedRuns } from './trackerFinalReports';
import { WatchdogIdleService } from '../WatchdogIdleService';
import { WatchdogPaneService } from '../WatchdogPaneService';
import { WatchdogStartupService } from '../WatchdogStartupService';
import type { WatchdogScan } from '../WatchdogPaneService.types';
import { publishTrackerSlotAlerts } from './trackerSlotAlerts';
import { queueIdleWork } from './trackerWatchLaunchRequests';
import { recordStartupAlerts } from './trackerHostWatchdogAlerts';
import { applyIdleDecision } from './trackerHostWatchdogIdle';
import {
	activeWatchdogItem,
	finishObservedRuns,
	watchdogSnapshot
} from './trackerHostWatchdogState';
import { adoptTrackerHandLaunches } from './trackerObservedRuns';
import { trackerContextHandoffs } from './trackerContextHandoff';
import { sampleTrackerContexts } from './trackerWatchdogContext';
import { recoveryPollInterval, sessionHealthInterval } from './trackerSessionHealth';
import {
	applyTrackerSessionHealth,
	readTrackerSessionHealth,
	recheckTrackerRecovery
} from './trackerSessionHealthRuntime';
import type { WatchdogSessionHost, WatchdogSessionScan } from './trackerWatchHostSessions.types';

export function watchHostSessions(hosts: WatchdogSessionHost, options: WatchdogSessionScan) {
	let lastHealthPoll = -Infinity;
	let lastContextPoll = -Infinity;
	return async (signal: AbortSignal) => {
		const now = options.now();
		if (now - lastHealthPoll < recoveryPollInterval) return undefined;
		lastHealthPoll = now;
		const sample = now - lastContextPoll >= sessionHealthInterval;
		if (sample) lastContextPoll = now;
		return scanHostSessions(
			hosts,
			{ ...options, roots: sample ? options.roots : undefined },
			signal
		);
	};
}

async function scanHostSessions(
	hosts: WatchdogSessionHost,
	options: WatchdogSessionScan,
	signal: AbortSignal
) {
	const inventory = await hosts.driver.scan(signal);
	signal.throwIfAborted();
	if (!inventory) return new Set<string>();
	const panes = await sampleTrackerContexts(inventory, options.roots ?? [], signal);
	const rows = options.readItems();
	const now = options.now();
	finishObservedRuns(
		hosts.store,
		new WatchdogIdleService().plan(watchdogSnapshot(hosts.store, rows, panes, now)).abandonRunIds,
		now
	);
	adoptTrackerHandLaunches(hosts.store, rows, panes);
	const snapshot = watchdogSnapshot(hosts.store, rows, panes, now);
	const canLaunch = options.automaticEnabled?.() !== false;
	await inspectHostSessions(
		hosts,
		{
			rows,
			snapshot,
			launch: canLaunch ? options.launch : undefined,
			settle: options.settle,
			ladderConfig: options.ladderConfig
		},
		signal
	);
	// After settling, so a run the launcher just finished is never reported as idle.
	publishTrackerSlotAlerts(hosts.store, snapshot.panes, {
		now: snapshot.now,
		cap: options.slotCap ?? null
	});
	if (canLaunch && options.idleWork)
		await queueIdleWork(hosts.store, { rows, snapshot, ...options.idleWork }, signal);
	return new Set(panes.filter(({ live }) => live).map(({ name }) => name));
}

async function inspectHostSessions(
	{ store, items, driver }: WatchdogSessionHost,
	{
		rows,
		snapshot,
		launch,
		settle,
		ladderConfig
	}: Pick<WatchdogSessionScan, 'launch' | 'settle' | 'ladderConfig'> & {
		rows: readonly TrackerItem[];
		snapshot: WatchdogScan;
	},
	signal: AbortSignal
) {
	recordStartupAlerts(store, snapshot, new WatchdogStartupService());
	await applyTrackerSessionHealth(
		store,
		readTrackerSessionHealth(store, rows, snapshot.panes, snapshot.now),
		{
			now: snapshot.now,
			items: rows,
			ladderConfig,
			launch:
				launch &&
				((item, attempt) =>
					recheckTrackerRecovery(
						{ store, driver, signal },
						item,
						(current) => launch(current, attempt),
						snapshot.now
					))
		},
		signal
	);
	const handled = await settleSessions(
		{ store, driver },
		{ snapshot, canRelaunch: Boolean(launch), settle },
		signal
	);
	const paneService = new WatchdogPaneService();
	for (const decision of new WatchdogIdleService().plan(snapshot).actions) {
		const pane = snapshot.panes.find(({ key }) => key === decision.paneKey);
		if (
			!pane ||
			handled.has(pane.key) ||
			!idleWatchdogItem(activeWatchdogItem(items, decision.id), snapshot.now)
		)
			continue;
		if (paneService.idlePrompt(pane) !== decision.cli) continue;
		const host = { store, driver, snapshot, settles: Boolean(settle) };
		await applyIdleDecision(host, { decision, pane }, signal);
	}
}

/** Panes taken by a context handoff or a finished report get no idle check-in. */
async function settleSessions(
	{ store, driver }: Pick<WatchdogSessionHost, 'store' | 'driver'>,
	{
		snapshot,
		canRelaunch,
		settle
	}: { snapshot: WatchdogScan; canRelaunch: boolean; settle?: TrackerDispatcherService },
	signal: AbortSignal
): Promise<Set<string>> {
	const handoffs = await trackerContextHandoffs(
		store,
		driver,
		{ ...snapshot, canRelaunch },
		signal
	);
	if (!settle) return handoffs;
	const reported = await finishReportedRuns(
		store,
		settle,
		{ scan: snapshot, skip: handoffs },
		signal
	);
	return new Set([...handoffs, ...reported]);
}

function idleWatchdogItem(item: TrackerItem | undefined, now: number): boolean {
	return item?.status === 'in_progress' && !trackerStoredSchedulingHold(item, now);
}
