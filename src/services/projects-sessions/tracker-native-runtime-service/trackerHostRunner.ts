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
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import {
	attemptKey,
	canonicalNode,
	trackerFlagBlocksRecovery
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
import {
	startTrackerHost,
	trackerHostStartupEvent,
	trackerItemStatus,
	withTrackerRunUsage
} from './trackerHostLaunchPort';

export function trackerHostRunner(
	store: TrackerPersistenceService,
	driver: TrackerHostLaunchPort,
	routeFor: TrackerHostRoute,
	{ tmux, legacyRunDirectory, now = Date.now }: TrackerHostRunnerOptions = {}
) {
	const items = new TrackerItemReadRepository(store.database);
	const node = canonicalNode(store.node, {});
	let sessions: TrackerHostSession[] = [];
	let panes: WatchdogPane[] = [];
	const legacyExit = legacyRunDirectory ? trackerLegacyExitReceipt(legacyRunDirectory) : undefined;
	const legacySession = (run: TrackerRunReceipt) =>
		legacyExit?.(run) ?? trackerLegacySession(run, sessions);
	return {
		inventory: () => sessions,
		runner: {
			async refresh(signal: AbortSignal, runs: readonly TrackerRunReceipt[]) {
				({ sessions, panes } = await trackerHostInventory(
					{ store, driver, tmux, node, keys: runs.map(attemptKey), now: now() },
					signal
				));
			},
			async start(reservation: TrackerReservedStart, signal: AbortSignal, instructions: string) {
				const item = items.getStored(reservation.run.item_id);
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
				const event = recordedHostEvent(run, { key, sessions, items, legacySession });
				return withTrackerRunUsage(event, { driver, run, items, now: now() }, signal);
			},
			confirmNeverStarted: driver.confirmNeverStarted?.bind(driver)
		},
		sessions: (itemId: string) => ({
			openSession: hasManualTrackerPane(panes, itemId),
			activeSessionKeys: activeTrackerSessionKeys(store, sessions, itemId)
		})
	};
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
	if (
		!route ||
		item.deleted ||
		!['open', 'in_progress'].includes(item.status ?? '') ||
		(item.needs_daniel &&
			!item.resolved &&
			(reservation.run.launch_source !== 'recovery' || trackerFlagBlocksRecovery(item.question))) ||
		item.auto !== reservation.run.auto_token
	)
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

function recordedHostEvent(
	run: TrackerRunReceipt,
	{
		key,
		sessions,
		items,
		legacySession
	}: {
		key: string;
		sessions: readonly TrackerHostSession[];
		items: TrackerItemReadRepository;
		legacySession(run: TrackerRunReceipt): TrackerHostSession | undefined;
	}
): TrackerDispatchEvent | undefined {
	const session = run.host_session_id
		? legacySession(run)
		: sessions.find(
				(entry) => !entry.legacyRunId && entry.key === key && entry.itemId === run.item_id
			);
	if (run.state === 'queued') return trackerHostStartupEvent(session);
	if (!session || session.id !== (run.host_session_id ?? run.session_id))
		return trackerItemStatus(items, run.item_id) === 'done'
			? { type: 'monitor', session: 'unknown' }
			: undefined;
	if (run.outcome === 'blocked' && session.state === 'live') return { type: 'resume', session };
	return {
		type: 'monitor',
		session: session.state,
		activityAt: session.activityAt,
		exitCode: session.exitCode
	};
}
