// @harness-uid u_bl6xl2h4a3
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { WatchdogIdleService } from '../WatchdogIdleService';
import { WatchdogPaneService } from '../WatchdogPaneService';
import { WatchdogStartupService } from '../WatchdogStartupService';
import type { WatchdogScan } from '../WatchdogPaneService.types';
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
import type { TrackerWatchdogLaunch } from './trackerSessionHealth.types';
import type { WatchdogSessionHost, WatchdogSessionScan } from './trackerWatchHostSessions.types';

export function watchHostSessions(hosts: WatchdogSessionHost, options: WatchdogSessionScan) {
	let lastHealthPoll = -Infinity;
	let lastContextPoll = -Infinity;
	return async (signal: AbortSignal) => {
		const now = options.now();
		if (now - lastHealthPoll < recoveryPollInterval) return;
		lastHealthPoll = now;
		const sample = now - lastContextPoll >= sessionHealthInterval;
		if (sample) lastContextPoll = now;
		await scanHostSessions(
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
	if (!inventory) return;
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
	await inspectHostSessions(hosts, { rows, snapshot, launch: options.launch }, signal);
}

async function inspectHostSessions(
	{ store, items, driver }: WatchdogSessionHost,
	{
		rows,
		snapshot,
		launch
	}: { rows: readonly TrackerItem[]; snapshot: WatchdogScan; launch?: TrackerWatchdogLaunch },
	signal: AbortSignal
) {
	recordStartupAlerts(store, snapshot, new WatchdogStartupService());
	await applyTrackerSessionHealth(
		store,
		readTrackerSessionHealth(store, rows, snapshot.panes, snapshot.now),
		{
			now: snapshot.now,
			items: rows,
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
	const handoffs = await trackerContextHandoffs(
		store,
		driver,
		{ ...snapshot, canRelaunch: Boolean(launch) },
		signal
	);
	const paneService = new WatchdogPaneService();
	for (const decision of new WatchdogIdleService().plan(snapshot).actions) {
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

function idleWatchdogItem(item?: TrackerItem): boolean {
	return item?.status === 'in_progress' && (!item.needs_daniel || item.resolved);
}
