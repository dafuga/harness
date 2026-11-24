// @harness-uid u_bl6xl2h4a3
import { statSync } from 'node:fs';
import { trackerHostAdmission } from './trackerHostAdmission';
import { trackerHostLaunchPort } from './trackerHostLaunchPort';
import { canonicalNode } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import { TrackerTmuxAdapter } from '../../../adapters/projects-sessions/TrackerTmuxAdapter';
import {
	pickTrackerModel,
	retryTrackerModel
} from '../../../utils/agents-providers/pickTrackerModel';
import type {
	TrackerDispatchItem,
	TrackerDispatchPolicy
} from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type {
	TrackerHostLaunchConfig,
	TrackerHostAdapterConfig,
	TrackerHostRepository,
	TrackerWorkerClient
} from './nativeTrackerHostEffects.types';
import type {
	TrackerHostRoute,
	TrackerHostRouteItem,
	TrackerHostTarget
} from './trackerHostLaunch.types';
import { trackerHostRunner } from './trackerHostRunner';

const macNodes = new Set(['daniel-primary-mbp', 'harbor-mbp-2']);

export function trackerHostLaunch(
	store: TrackerPersistenceService,
	config: TrackerHostLaunchConfig,
	effects: {
		tmuxExecutable?: string;
		adapter?: TrackerHostAdapterConfig;
		workerClient?: TrackerWorkerClient;
		transcriptRoots?: readonly string[];
		now?: () => number;
	} = {}
): NonNullable<TrackerNativeRuntimeOptions['dispatch']> {
	const { adapter } = effects;
	const tmuxExecutable =
		effects.tmuxExecutable ?? ('managed' in config ? config.managed.tmux : undefined);
	const driver = trackerHostLaunchPort(config, effects.workerClient, effects.transcriptRoots);
	const node = canonicalNode(store.node, {});
	const repositories = new Map(
		Object.entries(config.repositories).map(([project, route]) => [project.toLowerCase(), route])
	);
	const opsWorkdir = 'managed' in config ? config.managed.opsWorkdir : undefined;
	const routeFor = (item: TrackerHostRouteItem) =>
		approvedRoute(item, repositories, node, opsWorkdir);
	const tmux = tmuxExecutable
		? new TrackerTmuxAdapter({ executable: tmuxExecutable, node })
		: undefined;
	const host = trackerHostRunner(store, driver, routeFor, {
		tmux,
		legacyRunDirectory: config.legacyRunDirectory,
		now: effects.now
	});
	const admit = trackerHostAdmission(store, { config, adapter, routeFor }, host.inventory);
	return {
		runner: host.runner,
		sessions: host.sessions,
		policy: {
			timezone: 'Europe/Lisbon',
			chooseHost: chooseTrackerHost(routeFor, node),
			localRepoAvailable: (item) => Boolean(routeFor(item)),
			opsWorkdirAvailable: (item) => 'workdir' in (routeFor(item) ?? {}),
			admit,
			pickModel: pickHostModel,
			retryModel: retryTrackerModel
		},
		scheduleDue: config.due === true || adapter?.scheduleDue === true,
		due: () => ({
			enabled: config.due === true,
			paused: false,
			localDue: true,
			adapterDue: adapter?.scheduleDue === true
		})
	};
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

function pickHostModel(item: TrackerDispatchItem) {
	try {
		return pickTrackerModel(item);
	} catch {
		return { error: 'Tracker model cannot be selected for this task' };
	}
}

/** Build the host launch dispatch from configured host effects, when launch is enabled. */
export function configuredHostDispatch(
	store: TrackerPersistenceService,
	effects: TrackerNativeRuntimeOptions['hostEffects'],
	now: () => number
) {
	const { launch, watchdog, adapter, workerClient } = effects ?? {};
	return launch
		? trackerHostLaunch(store, launch, {
				workerClient,
				transcriptRoots: watchdog?.transcriptRoots,
				adapter,
				now,
				tmuxExecutable: watchdog && 'tmux' in watchdog ? watchdog.tmux : undefined
			})
		: undefined;
}
