// @harness-uid u_bl6xl2h4a3
import type { WatchdogPane } from '../WatchdogPaneService.types';
import {
	legacyTrackerStartupProbe,
	trackerLegacyExitReceipt,
	trackerLegacySession
} from './trackerLegacyExitReceipt';
import {
	finishedTrackerSession,
	hasManualTrackerPane,
	trackerHostInventory
} from './trackerHostInventory';
import { trackerStoredSchedulingHold } from '../../../repositories/projects-sessions/tracker-dispatch-repository/dispatchItemFields';
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import {
	attemptKey,
	canonicalNode,
	trackerReminderTitle
} from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type {
	TrackerDispatchEvent,
	TrackerRunReceipt
} from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerReservedStart } from '../TrackerDispatchSchedulerService.types';
import type {
	TrackerHostLaunchPort,
	TrackerHostRoute,
	TrackerHostRunnerOptions,
	TrackerHostSession
} from './trackerHostLaunch.types';
import { formatTrackerHostBrief } from './trackerHostBrief';
import { recordedHostEvent } from './trackerHostRunEvents';
import { startTrackerHost, withTrackerRunUsage } from './trackerHostLaunchPort';

export function trackerHostRunner(
	store: TrackerPersistenceService,
	driver: TrackerHostLaunchPort,
	routeFor: TrackerHostRoute,
	options: TrackerHostRunnerOptions = {}
) {
	const { tmux, legacyRunDirectory, now = Date.now, automaticEnabled } = options;
	const items = new TrackerItemReadRepository(store.database);
	const node = canonicalNode(store.node, {});
	let [sessions, panes]: [TrackerHostSession[], WatchdogPane[]] = [[], []];
	const legacySession = legacySessionReader(legacyRunDirectory, () => sessions);
	return {
		runner: {
			async refresh(signal: AbortSignal, runs: readonly TrackerRunReceipt[]) {
				({ sessions, panes } = await trackerHostInventory(
					{ store, driver, tmux, node, keys: runs.map(attemptKey), now: now() },
					signal
				));
			},
			async start(reservation: TrackerReservedStart, signal: AbortSignal, instructions: string) {
				const item = items.getStored(reservation.run.item_id);
				if (automaticHostHold(item, reservation.run, { now, automaticEnabled }))
					return {
						type: 'startup-failed',
						reason: 'automatic launch no longer permitted'
					} as const;
				const result = await launchApprovedItem(
					{ driver, node, routeFor },
					{ item, reservation, instructions },
					signal
				);
				if (result?.type === 'session') sessions.push({ ...result.session, itemId: item.id });
				return result;
			},
			legacySession,
			confirmLegacyNeverStarted: legacyTrackerStartupProbe(
				driver,
				tmux && legacyRunDirectory,
				() => panes
			),
			async observe(run: TrackerRunReceipt, key: string, signal: AbortSignal) {
				const event = recordedHostEvent(run, { key, sessions, items, legacySession, store });
				return withTrackerRunUsage(event, { driver, run, items, now: now() }, signal);
			},
			...optionalHostControls(driver)
		},
		sessions: (itemId: string) => ({
			openSession: hasManualTrackerPane(panes, itemId),
			activeSessionKeys: activeTrackerSessionKeys(store, sessions, itemId)
		})
	};
}

function legacySessionReader(
	directory: string | undefined,
	sessions: () => readonly TrackerHostSession[]
) {
	const exit = directory ? trackerLegacyExitReceipt(directory) : undefined;
	return (run: TrackerRunReceipt) => exit?.(run) ?? trackerLegacySession(run, sessions());
}

function activeTrackerSessionKeys(
	store: TrackerPersistenceService,
	sessions: readonly TrackerHostSession[],
	itemId: string
): string[] {
	return sessions
		.filter(
			(session) =>
				!session.legacyRunId &&
				session.itemId === itemId &&
				session.state === 'live' &&
				!finishedTrackerSession(store, session)
		)
		.map(({ key }) => key);
}

async function launchApprovedItem(
	{
		driver,
		node,
		routeFor
	}: { driver: TrackerHostLaunchPort; node: string; routeFor: TrackerHostRoute },
	{
		item,
		reservation,
		instructions
	}: { item: TrackerItem; reservation: TrackerReservedStart; instructions: string },
	signal: AbortSignal
): Promise<TrackerDispatchEvent | undefined> {
	const route = routeFor(item);
	if (!route || !hostItemMatchesRun(item, reservation.run))
		return {
			type: 'startup-failed',
			reason: 'Tracker launch no longer has an approved execution directory'
		};
	return startTrackerHost(
		driver,
		{
			node,
			route,
			reservation,
			brief: formatTrackerHostBrief(
				item,
				instructions,
				reservation.run.launch_source === 'recovery'
			)
		},
		signal
	);
}

function automaticHostHold(
	item: TrackerItem,
	run: TrackerRunReceipt,
	{ now, automaticEnabled }: { now: () => number; automaticEnabled?: () => boolean }
) {
	return (
		(run.launch_source !== 'manual' || run.attempt > 1) &&
		(automaticEnabled?.() === false || trackerStoredSchedulingHold(item, now()))
	);
}

function hostItemMatchesRun(item: TrackerItem, run: TrackerRunReceipt) {
	return (
		!item.deleted &&
		['open', 'in_progress'].includes(item.status ?? '') &&
		!(item.needs_daniel && !item.resolved) &&
		(item.kind ?? 'task') === 'task' &&
		!trackerReminderTitle(item.title ?? '') &&
		item.auto === run.auto_token
	);
}

function optionalHostControls(driver: TrackerHostLaunchPort) {
	return {
		stop: driver.stop?.bind(driver),
		confirmNeverStarted: driver.confirmNeverStarted?.bind(driver)
	};
}
