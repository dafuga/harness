// @harness-uid u_bl6xl2h4a3
import { statfsSync } from 'node:fs';
import type { TrackerDispatchPolicy } from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type {
	TrackerHostAdapterConfig,
	TrackerHostLaunchConfig
} from './nativeTrackerHostEffects.types';
import type {
	TrackerHostRoute,
	TrackerHostSession,
	TrackerHostTarget
} from './trackerHostLaunch.types';
import { finishedTrackerSession } from './trackerHostInventory';

export const trackerHostCapacityHold = 'Tracker host is at session capacity';

export function trackerHostAdmission(
	store: TrackerPersistenceService,
	{
		config,
		adapter,
		routeFor
	}: {
		config: TrackerHostLaunchConfig;
		adapter?: TrackerHostAdapterConfig;
		routeFor: TrackerHostRoute;
	},
	inventory: () => readonly TrackerHostSession[]
): TrackerDispatchPolicy['admit'] {
	const cap = config.maxConcurrent ?? 2;
	return (item, intent, rung) => {
		const route = routeFor(item);
		if (!route || !configuredLane(config, route.platform))
			return 'no approved Tracker repository or platform for this node';
		if (occupiedHostSlots(store, inventory()) >= cap) return trackerHostCapacityHold;
		if (rung && !['codex', 'claude'].includes(rung.cli)) return 'no supported Tracker provider';
		if (adapter?.dueDisk && intent.source === 'due' && item.adapterDueOwner === store.node)
			return adapterDueDiskHold({
				config,
				route,
				dueDisk: adapter.dueDisk
			});
		return null;
	};
}

export function occupiedHostSlots(
	store: TrackerPersistenceService,
	sessions: readonly TrackerHostSession[]
): number {
	const reserved = store.database
		.prepare(
			`SELECT r.id, r.item_id, r.auto_token, r.attempt FROM runs r
		LEFT JOIN meta m ON m.k = 'harness_dispatch_run:' || r.id
		WHERE r.state IN ('running','verifying')
		OR (r.state = 'queued' AND json_extract(m.v, '$.dispatch_at') IS NOT NULL)`
		)
		.all() as {
		id: number;
		item_id: string;
		auto_token: string;
		attempt: number;
	}[];
	const runIds = new Set(reserved.map(({ id }) => id));
	const keys = new Set(
		reserved.map(({ item_id, auto_token, attempt }) =>
			JSON.stringify([item_id, auto_token, attempt])
		)
	);
	const independent = sessions.filter((session) => {
		const { state, key, legacyRunId } = session;
		return (
			state === 'live' &&
			!keys.has(key) &&
			(legacyRunId === undefined || !runIds.has(legacyRunId)) &&
			!finishedTrackerSession(store, session)
		);
	});
	return reserved.length + independent.length;
}

function trackerAdapterDiskHold(
	path: string,
	{ freePct, freeGB }: NonNullable<TrackerHostAdapterConfig['dueDisk']>
): string | null {
	try {
		const fs = statfsSync(path);
		const available = fs.bavail * fs.bsize;
		const percent = (100 * fs.bavail) / fs.blocks;
		if (!Number.isFinite(available) || !Number.isFinite(percent))
			return 'Tracker adapter disk sample unavailable';
		return available / 1e9 < freeGB || percent < freePct
			? 'Tracker adapter due launch is held by its disk thresholds'
			: null;
	} catch {
		return 'Tracker adapter disk sample unavailable';
	}
}

function configuredLane(config: TrackerHostLaunchConfig, platform: 'linux' | 'macos'): boolean {
	return (
		'driver' in config ||
		Boolean(platform === 'linux' ? config.managed.docker : config.managed.native)
	);
}

function adapterDueDiskHold({
	config,
	route,
	dueDisk
}: {
	config: TrackerHostLaunchConfig;
	route: TrackerHostTarget;
	dueDisk: NonNullable<TrackerHostAdapterConfig['dueDisk']>;
}) {
	const repoHold = trackerAdapterDiskHold('workdir' in route ? route.workdir : route.repo, dueDisk);
	if (repoHold || 'driver' in config) return repoHold;
	return trackerAdapterDiskHold(config.managed.stateDirectory, dueDisk);
}
