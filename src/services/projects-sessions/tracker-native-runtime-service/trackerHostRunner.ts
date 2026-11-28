// @harness-uid u_bl6xl2h4a3
import { isTrackerAwaitingAnswer } from '../../../utils/projects-sessions/isTrackerAwaitingAnswer';
import type { WatchdogPane } from '../WatchdogPaneService.types';
import {
	legacyTrackerStartupProbe,
	trackerLegacyExitReceipt,
	trackerLegacySession
} from './trackerLegacyExitReceipt';
import {
	hasManualTrackerPane,
	retiredTrackerSession,
	trackerHostInventory
} from './trackerHostInventory';
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
	TrackerHostLaunchContext,
	TrackerHostLaunchPort,
	TrackerHostRoute,
	TrackerHostRunnerOptions,
	TrackerHostSession
} from './trackerHostLaunch.types';
import { trackerHandSession } from '../../../utils/projects-sessions/trackerSessionNames';
import type { TrackerTmuxWindow } from '../../../utils/projects-sessions/trackerSessionNames.types';
import { trackerHostReport, trackerRouteSessionName, withLaunchOrigin } from './trackerHostReport';
import { formatTrackerHostBrief, trackerLaunchContext } from './trackerHostBrief';
import { recordedHostEvent } from './trackerHostRunEvents';
import { startTrackerHost } from './trackerHostLaunchPort';
import { trackerCpuBudget } from '../../../utils/projects-sessions/trackerCpuBudget';
import { recordOverdueAlert } from './trackerHostWatchdogAlerts';
import { automaticHostHold } from './trackerQueueAdmission';

export function trackerHostRunner(
	store: TrackerPersistenceService,
	driver: TrackerHostLaunchPort,
	routeFor: TrackerHostRoute,
	options: TrackerHostRunnerOptions = {}
) {
	const { tmux, legacyRunDirectory, now = Date.now, automaticEnabled } = options;
	const items = new TrackerItemReadRepository(store.database, now);
	const node = canonicalNode(store.node, {});
	let inventory = emptyHostInventory();
	const legacySession = legacySessionReader(legacyRunDirectory, () => inventory.sessions);
	const report = trackerHostReport({ store, driver, routeFor, now }, options.verifyCommand);
	return {
		runner: {
			async refresh(signal: AbortSignal, runs: readonly TrackerRunReceipt[]) {
				report.retain(runs);
				const refreshed = await trackerHostInventory(
					{ store, driver, tmux, node, runs, keys: runs.map(attemptKey), now: now() },
					signal
				);
				signal.throwIfAborted();
				inventory = refreshed;
			},
			async start(reservation: TrackerReservedStart, signal: AbortSignal, instructions: string) {
				const item = items.getStored(reservation.run.item_id);
				if (automaticHostHold(store, item, reservation.run, { now, automaticEnabled }))
					return {
						type: 'startup-failed',
						reason: 'automatic launch no longer permitted'
					} as const;
				const result = await launchApprovedItem(
					{ driver, node, routeFor, store },
					{ item, reservation, instructions },
					signal
				);
				signal.throwIfAborted();
				if (result?.type === 'session')
					inventory.sessions.push({ ...result.session, itemId: item.id });
				return withLaunchOrigin(result, routeFor(item), item);
			},
			legacySession,
			confirmLegacyNeverStarted: legacyTrackerStartupProbe(
				driver,
				tmux && legacyRunDirectory,
				() => inventory.panes
			),
			observe: (run: TrackerRunReceipt, key: string, signal: AbortSignal) =>
				report(recordedHostEvent(run, { key, ...inventory, items, legacySession }), run, signal),
			overdue: (run: TrackerRunReceipt, reason: string) =>
				recordOverdueAlert(store, run, { reason, at: now() }),
			...optionalHostControls(driver)
		},
		sessions: (itemId: string) => itemSessions({ store, items, ...inventory }, itemId)
	};
}

function emptyHostInventory() {
	return {
		sessions: [] as TrackerHostSession[],
		panes: [] as WatchdogPane[],
		windows: [] as TrackerTmuxWindow[]
	};
}

/** What the host currently knows about sessions already working on an item. */
function itemSessions(
	{
		store,
		items,
		sessions,
		panes,
		windows
	}: {
		store: TrackerPersistenceService;
		items: TrackerItemReadRepository;
		sessions: readonly TrackerHostSession[];
		panes: readonly WatchdogPane[];
		windows: readonly TrackerTmuxWindow[];
	},
	itemId: string
) {
	return {
		openSession:
			hasManualTrackerPane(panes, itemId) ||
			(windows.length > 0 && trackerHandSession(windows, items.getStored(itemId))),
		activeSessionKeys: activeTrackerSessionKeys(store, sessions, itemId)
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
				!retiredTrackerSession(store, session)
		)
		.map(({ key }) => key);
}

async function launchApprovedItem(
	{ driver, node, routeFor, store }: TrackerHostLaunchContext,
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
	const cpuBudget = trackerCpuBudget(node, item.project ?? item.agent);
	return startTrackerHost(
		driver,
		{
			node,
			route,
			reservation,
			cpuBudget,
			sessionName: trackerRouteSessionName(item, route),
			brief: formatTrackerHostBrief(item, instructions, {
				launch: trackerLaunchContext(store, item, reservation.run, route),
				recovery: reservation.run.launch_source === 'recovery',
				cpuBudget
			})
		},
		signal
	);
}

function hostItemMatchesRun(item: TrackerItem, run: TrackerRunReceipt) {
	return (
		!item.deleted &&
		['open', 'in_progress'].includes(item.status ?? '') &&
		!isTrackerAwaitingAnswer(item) &&
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
