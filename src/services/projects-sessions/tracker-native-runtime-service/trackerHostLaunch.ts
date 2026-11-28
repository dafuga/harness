// @harness-uid u_bl6xl2h4a3
import { statfsSync, statSync } from 'node:fs';
import { freeHostSessionSlots, trackerHostAdmission } from './trackerHostAdmission';
import { TrackerHostResourceAdapter } from '../../../adapters/projects-sessions/TrackerHostResourceAdapter';
import { trackerHostLaunchPort } from './trackerHostLaunchPort';
import { canonicalNode } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import { TrackerTmuxAdapter } from '../../../adapters/projects-sessions/TrackerTmuxAdapter';
import type { TrackerLadderConfig } from '../../../utils/agents-providers/parseTrackerModelSpec.types';
import { trackerHostModelPolicy } from './trackerHostModelPick';
import type { TrackerDispatchPolicy } from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type {
	TrackerHostLaunchConfig,
	TrackerHostAdapterConfig,
	TrackerHostRepository,
	TrackerWorkerClient
} from './nativeTrackerHostEffects.types';
import type {
	TrackerHostDispatchSettings,
	TrackerHostRoute,
	TrackerHostRouteItem,
	TrackerHostTarget
} from './trackerHostLaunch.types';
import { configuredTrackerProviderHold } from './trackerProviderHolds';
import { trackerHostRunner } from './trackerHostRunner';
import type { TrackerHostResources } from '../../../utils/projects-sessions/trackerHostResources.types';

const macNodes = new Set(['daniel-primary-mbp', 'harbor-mbp-2']);

export function trackerHostLaunch(
	store: TrackerPersistenceService,
	config: TrackerHostLaunchConfig,
	effects: {
		tmuxExecutable?: string;
		recoverDroppedSessions?: boolean;
		automaticEnabled?(): boolean;
		adapter?: TrackerHostAdapterConfig;
		workerClient?: TrackerWorkerClient;
		transcriptRoots?: readonly string[];
		now?: () => number;
		ladderConfig?: TrackerLadderConfig;
		hostResources?: TrackerHostResources;
	} = {}
): NonNullable<TrackerNativeRuntimeOptions['dispatch']> {
	const { adapter } = effects;
	const driver = trackerHostLaunchPort(config, effects.workerClient, effects.transcriptRoots);
	const node = canonicalNode(store.node, {});
	const repositories = new Map(
		Object.entries(config.repositories).map(([project, route]) => [project.toLowerCase(), route])
	);
	const opsWorkdir = 'managed' in config ? config.managed.opsWorkdir : undefined;
	const hostResources =
		effects.hostResources ?? ('managed' in config ? new TrackerHostResourceAdapter() : undefined);
	const routeFor = (item: TrackerHostRouteItem) =>
		approvedRoute(item, repositories, node, opsWorkdir);
	const tmux = trackerLaunchTmux(config, node, effects.tmuxExecutable);
	const host = trackerHostRunner(store, driver, routeFor, {
		tmux,
		legacyRunDirectory: config.legacyRunDirectory,
		verifyCommand: (run) =>
			[...repositories.values()].find(({ repo }) => repo === run.source_repo)?.verify,
		now: effects.now,
		automaticEnabled: effects.automaticEnabled
	});
	return {
		runner: trackerCapacityRunner(host, store, config, { repositories, hostResources }),
		sessions: host.sessions,
		policy: {
			timezone: 'Europe/Lisbon',
			recoverDroppedSessions: effects.recoverDroppedSessions,
			automaticEnabled: effects.automaticEnabled,
			chooseHost: chooseTrackerHost(routeFor, node),
			localRepoAvailable: (item) => Boolean(routeFor(item)),
			opsWorkdirAvailable: (item) => 'workdir' in (routeFor(item) ?? {}),
			admit: trackerHostAdmission(store, { ...effects, config, routeFor, hostResources }),
			providerHold: configuredTrackerProviderHold(store, config.codexPausedUntil, effects.now),
			...trackerHostModelPolicy(store, config, effects)
		},
		...hostDueSchedule(config, adapter)
	};
}

function hostDueSchedule(config: TrackerHostLaunchConfig, adapter?: TrackerHostAdapterConfig) {
	const [enabled, adapterDue] = [config.due !== false, adapter?.scheduleDue === true];
	return {
		scheduleDue: enabled || adapterDue,
		due: () => ({ enabled, paused: false, localDue: true, adapterDue })
	};
}

function trackerLaunchTmux(config: TrackerHostLaunchConfig, node: string, configured?: string) {
	const executable = configured ?? ('managed' in config ? config.managed.tmux : undefined);
	return executable ? new TrackerTmuxAdapter({ executable, node }) : undefined;
}

function trackerCapacityRunner(
	host: ReturnType<typeof trackerHostRunner>,
	store: TrackerPersistenceService,
	config: TrackerHostLaunchConfig,
	{
		repositories,
		hostResources
	}: {
		repositories: ReadonlyMap<string, TrackerHostRepository>;
		hostResources?: TrackerHostResources;
	}
) {
	return {
		...host.runner,
		capacity: () => ({
			freeSlots: freeHostSessionSlots(store, config, hostResources),
			projects: adapterProjectCapacity(config, repositories)
		})
	};
}

function adapterProjectCapacity(
	config: TrackerHostLaunchConfig,
	repositories: ReadonlyMap<string, TrackerHostRepository>
) {
	const projects: Record<string, { freePct: number; freeGB: number }> = {};
	if (!('managed' in config)) return projects;
	for (const [project, route] of repositories) {
		if (!canAdvertiseAdapterRoute(config.managed, route.platform)) continue;
		try {
			const disks = [statfsSync(route.repo), statfsSync(config.managed.stateDirectory)];
			projects[project] = {
				freeGB: Math.floor(Math.min(...disks.map(({ bavail, bsize }) => (bavail * bsize) / 1e9))),
				freePct: Math.floor(Math.min(...disks.map(({ bavail, blocks }) => (100 * bavail) / blocks)))
			};
		} catch {
			// A host without its checkout or worktree filesystem cannot take the task.
		}
	}
	return projects;
}

function canAdvertiseAdapterRoute(
	config: Extract<TrackerHostLaunchConfig, { managed: unknown }>['managed'],
	platform: TrackerHostRepository['platform']
) {
	return platform === 'macos'
		? process.platform === 'darwin' && Boolean(config.native)
		: process.platform === 'linux' && Boolean(config.docker);
}

function chooseTrackerHost(
	routeFor: TrackerHostRoute,
	node: string
): TrackerDispatchPolicy['chooseHost'] {
	return (item, { requestedNode }) => {
		const route = routeFor(item);
		if (!route || (requestedNode && canonicalNode(requestedNode, {}) !== node)) {
			return {
				node: null,
				why: 'no approved Tracker repository or operations workdir on the selected computer'
			};
		}
		return {
			node,
			why:
				'workdir' in route
					? 'approved local operations workdir'
					: 'approved local Tracker repository'
		};
	};
}

function approvedRoute(
	item: TrackerHostRouteItem,
	repositories: ReadonlyMap<string, TrackerHostRepository>,
	node: string,
	opsWorkdir?: string
): TrackerHostTarget | undefined {
	const project = (item.project ?? item.agent)?.toLowerCase();
	const route = project
		? repositories.get(project)
		: [...repositories.values()].find(({ repo }) => item.repo === repo);
	if (!route) return approvedOpsWorkdir(item, node, opsWorkdir);
	if (item.repo && item.repo !== route.repo) return undefined;
	return route.platform !== 'macos' || macNodes.has(node) ? route : undefined;
}

function approvedOpsWorkdir(item: TrackerHostRouteItem, node: string, workdir?: string) {
	if (item.repo || item.project || !workdir || !macNodes.has(node)) return undefined;
	if (statSync(workdir, { throwIfNoEntry: false })?.isDirectory())
		return { workdir, platform: 'macos' } as const;
	return undefined;
}

/** Build the host launch dispatch from configured host effects, when launch is enabled. */
export function configuredHostDispatch(
	store: TrackerPersistenceService,
	effects: TrackerNativeRuntimeOptions['hostEffects'],
	settings: TrackerHostDispatchSettings
) {
	const { launch, watchdog, adapter, workerClient } = effects ?? {};
	const { now, automaticEnabled, ladderConfig } = settings;
	return launch
		? trackerHostLaunch(store, launch, {
				workerClient,
				hostResources: effects?.hostResources,
				automaticEnabled,
				transcriptRoots: watchdog?.transcriptRoots,
				recoverDroppedSessions: watchdog && ('tmux' in watchdog || 'driver' in watchdog),
				adapter,
				now,
				ladderConfig,
				tmuxExecutable: watchdog && 'tmux' in watchdog ? watchdog.tmux : undefined
			})
		: undefined;
}
