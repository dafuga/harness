// @harness-uid u_bl6xl2h4a3
import { statfsSync } from 'node:fs';
import type { TrackerDispatchPolicy } from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { trackerProviderHold } from './trackerProviderHolds';
import type {
	TrackerHostAdapterConfig,
	TrackerHostLaunchConfig
} from './nativeTrackerHostEffects.types';
import type { TrackerHostRoute, TrackerHostTarget } from './trackerHostLaunch.types';
import type { TrackerOccupiedRun } from './trackerHostAdmission.types';
import type { TrackerHostResources } from '../../../utils/projects-sessions/trackerHostResources.types';
import { trackerHostRamSlots, trackerHostResourceAdmission } from './trackerHostResourceAdmission';
import {
	trackerMachineRole,
	trackerMacRole
} from '../../../utils/projects-sessions/trackerMachineStatus';

export const trackerHostCapacityHold = 'Tracker host is at session capacity';

export function trackerHostAdmission(
	store: TrackerPersistenceService,
	{
		config,
		adapter,
		routeFor,
		hostResources,
		now = Date.now
	}: {
		config: TrackerHostLaunchConfig;
		adapter?: TrackerHostAdapterConfig;
		routeFor: TrackerHostRoute;
		hostResources?: TrackerHostResources;
		now?: () => number;
	}
): TrackerDispatchPolicy['admit'] {
	const cap = trackerHostSessionCap(store.node, config);
	const hostHold = trackerHostResourceAdmission(store, config, {
		resources: hostResources,
		occupied: () => occupiedHostRuns(store)
	});
	return (item, intent, rung) => {
		const route = routeFor(item);
		if (!route || !configuredLane(config, route.platform))
			return 'no approved Tracker repository or platform for this node';
		if (occupiedHostSlots(store) >= cap) return trackerHostCapacityHold;
		const unavailable = rung && providerAdmissionHold(store, rung.cli, now());
		if (unavailable) return unavailable;
		const shortage = hostHold(item, route);
		if (shortage) return shortage;
		const adapterDue = intent.source === 'due' && item.adapterDueOwner === store.node;
		return adapterDue ? adapterDueDiskHold({ config, route, dueDisk: adapter?.dueDisk }) : null;
	};
}

export function trackerHostSessionCap(node: string, config: TrackerHostLaunchConfig): number {
	return config.maxConcurrent ?? (trackerMacRole(trackerMachineRole(node)) ? 20 : 2);
}

export function freeHostSessionSlots(
	store: TrackerPersistenceService,
	config: TrackerHostLaunchConfig,
	resources?: TrackerHostResources
): number {
	const free = trackerHostSessionCap(store.node, config) - occupiedHostSlots(store);
	return Math.max(0, Math.min(free, trackerHostRamSlots(store.node, resources)));
}

function providerAdmissionHold(store: TrackerPersistenceService, cli: string, now: number) {
	if (cli !== 'codex' && cli !== 'claude') return 'no supported Tracker provider';
	return trackerProviderHold(store, cli, now);
}

/** Only runs the launcher is truly running hold a slot; leftover tmux sessions never do. */
const slotRuns = `FROM runs r
	LEFT JOIN meta m ON m.k = 'harness_dispatch_run:' || r.id
	LEFT JOIN items i ON i.id = r.item_id
	WHERE r.state IN ('running','verifying')
	OR (r.state = 'queued' AND json_extract(m.v, '$.dispatch_at') IS NOT NULL)`;

export function occupiedHostSlots(store: TrackerPersistenceService): number {
	const { count } = store.database.prepare(`SELECT count(*) AS count ${slotRuns}`).get() as {
		count: number;
	};
	return count;
}

/** The runs behind that count, for the watchdog's slot report. */
export function occupiedHostRuns(store: TrackerPersistenceService): TrackerOccupiedRun[] {
	return store.database
		.prepare(
			`SELECT r.id, r.item_id AS itemId, r.state, r.cli, r.tmux, r.watch_pane AS watchPane,
			r.started_at AS startedAt, r.resumed_at AS resumedAt, i.status, i.deleted,
			((i.needs_daniel = 1 AND coalesce(i.resolved, 0) = 0) OR i.chief_review IS NOT NULL) AS waiting
			${slotRuns} ORDER BY r.id`
		)
		.all() as unknown as TrackerOccupiedRun[];
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
	dueDisk: TrackerHostAdapterConfig['dueDisk'];
}) {
	if (!dueDisk) return null;
	const repoHold = trackerAdapterDiskHold('workdir' in route ? route.workdir : route.repo, dueDisk);
	if (repoHold || 'driver' in config) return repoHold;
	return trackerAdapterDiskHold(config.managed.stateDirectory, dueDisk);
}
