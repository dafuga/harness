// @harness-uid u_bl6xl2h4a3
import type { TrackerTmuxAdapter } from '../../../adapters/projects-sessions/TrackerTmuxAdapter';
import type { WatchdogPane } from '../WatchdogPaneService.types';
import { trackerLegacyExitReceipt } from './trackerLegacyExitReceipt';
import { trackerHostInventory } from './trackerHostInventory';
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import {
	attemptKey,
	canonicalNode
} from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type {
	TrackerDispatchEvent,
	TrackerRunReceipt
} from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerReservedStart } from '../TrackerDispatchSchedulerService.types';
import type { TrackerHostRepository } from './nativeTrackerHostEffects.types';
import type {
	TrackerHostLaunchPort,
	TrackerHostRoute,
	TrackerHostSession
} from './trackerHostLaunch.types';
import { formatTrackerHostBrief } from './trackerHostBrief';

export function trackerHostRunner(
	store: TrackerPersistenceService,
	driver: TrackerHostLaunchPort,
	routeFor: TrackerHostRoute,
	{ tmux, legacyRunDirectory }: { tmux?: TrackerTmuxAdapter; legacyRunDirectory?: string } = {}
) {
	const items = new TrackerItemReadRepository(store.database);
	const node = canonicalNode(store.node, {});
	let sessions: TrackerHostSession[] = [];
	let manual: WatchdogPane[] = [];
	const legacyExit = legacyRunDirectory ? trackerLegacyExitReceipt(legacyRunDirectory) : undefined;
	const legacySession = (run: TrackerRunReceipt) =>
		legacyExit?.(run) ?? trackerLegacySession(run, sessions);
	return {
		inventory: () => sessions,
		runner: {
			async refresh(signal: AbortSignal, runs: readonly TrackerRunReceipt[]) {
				({ sessions, manual } = await trackerHostInventory(
					{ driver, tmux, node, keys: runs.map(attemptKey) },
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
			async observe(run: TrackerRunReceipt, key: string) {
				return recordedHostEvent(run, { key, sessions, items, legacySession });
			}
		},
		sessions(itemId: string) {
			return {
				openSession: manual.some((pane) => itemId.startsWith(pane.name.slice(5))),
				activeSessionKeys: sessions
					.filter(
						(session) =>
							!session.legacyRunId && session.itemId === itemId && session.state === 'live'
					)
					.map(({ key }) => key)
			};
		}
	};
}

async function startTrackerHost(
	driver: TrackerHostLaunchPort,
	input: {
		node: string;
		route: TrackerHostRepository;
		reservation: TrackerReservedStart;
		brief: string;
	},
	signal: AbortSignal
): Promise<TrackerDispatchEvent | undefined> {
	const {
		node,
		route,
		reservation: { run, key, selection },
		brief
	} = input;
	const result = await driver.start(
		{
			node,
			itemId: run.item_id,
			runId: run.id,
			key,
			selection,
			brief,
			...route,
			backend: route.platform === 'macos' ? 'native' : 'docker',
			queuedAt: run.queued_at
		},
		signal
	);
	if (result.status === 'rejected')
		return { type: 'startup-failed', reason: 'Tracker host declined the reserved launch' };
	if (
		result.status === 'started' &&
		result.session.key === key &&
		result.session.itemId === run.item_id &&
		!result.session.legacyRunId
	)
		return { type: 'session', session: result.session };
	return undefined;
}

function trackerLegacySession(run: TrackerRunReceipt, sessions: readonly TrackerHostSession[]) {
	const session = sessions.find(
		(entry) =>
			entry.legacyRunId === run.id &&
			entry.tmux === run.tmux &&
			(entry.itemId === run.item_id || entry.itemId === run.item_id.slice(0, 6))
	);
	return session && { ...session, key: attemptKey(run) };
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
		(item.needs_daniel && !item.resolved) ||
		item.auto !== reservation.run.auto_token
	)
		return {
			type: 'startup-failed',
			reason: 'Tracker launch no longer has an approved repository'
		};
	return startTrackerHost(
		driver,
		{
			node,
			route,
			reservation,
			brief: formatTrackerHostBrief(item, instructions)
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
	if (run.state === 'queued') return session && { type: 'session', session };
	if (!session || session.id !== (run.host_session_id ?? run.session_id))
		return finishedTrackerItem(items, run.item_id)
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

function finishedTrackerItem(items: TrackerItemReadRepository, id: string): boolean {
	try {
		return items.getStored(id).status === 'done';
	} catch {
		return false;
	}
}
