// @harness-uid u_bl6xl2h4a3
import { trackerHostAdmission } from './trackerHostAdmission';
import { trackerHostLaunchPort } from './trackerHostLaunchPort';
import { canonicalNode } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import { TrackerTmuxAdapter } from '../../../adapters/projects-sessions/TrackerTmuxAdapter';
import {
	pickTrackerModel,
	retryTrackerModel
} from '../../../utils/agents-providers/pickTrackerModel';
import type { TrackerDispatchItem } from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type {
	TrackerHostLaunchConfig,
	TrackerHostAdapterConfig,
	TrackerHostRepository,
	TrackerWorkerClient
} from './nativeTrackerHostEffects.types';
import type { TrackerHostRouteItem } from './trackerHostLaunch.types';
import { trackerHostRunner } from './trackerHostRunner';

const macNodes = new Set(['daniel-primary-mbp', 'harbor-mbp-2']);

export function trackerHostLaunch(
	store: TrackerPersistenceService,
	config: TrackerHostLaunchConfig,
	effects: {
		tmuxExecutable?: string;
		adapter?: TrackerHostAdapterConfig;
		workerClient?: TrackerWorkerClient;
	} = {}
): NonNullable<TrackerNativeRuntimeOptions['dispatch']> {
	const { adapter } = effects;
	const tmuxExecutable =
		effects.tmuxExecutable ?? ('managed' in config ? config.managed.tmux : undefined);
	const driver = trackerHostLaunchPort(config, effects.workerClient);
	const node = canonicalNode(store.node, {});
	const repositories = new Map(
		Object.entries(config.repositories).map(([project, route]) => [project.toLowerCase(), route])
	);
	const routeFor = (item: TrackerHostRouteItem) => approvedRoute(item, repositories, node);
	const tmux = tmuxExecutable
		? new TrackerTmuxAdapter({ executable: tmuxExecutable, node })
		: undefined;
	const host = trackerHostRunner(store, driver, routeFor, {
		tmux,
		legacyRunDirectory: config.legacyRunDirectory
	});
	const admit = trackerHostAdmission(store, { config, adapter, routeFor }, host.inventory);
	return {
		runner: host.runner,
		sessions: host.sessions,
		policy: {
			timezone: 'Europe/Lisbon',
			chooseHost(item, { requestedNode }) {
				if ((!requestedNode || canonicalNode(requestedNode, {}) === node) && routeFor(item))
					return { node, why: 'approved local Tracker repository' };
				return { node: null, why: 'no approved local Tracker repository' };
			},
			localRepoAvailable: (item) => Boolean(routeFor(item)),
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

function approvedRoute(
	item: TrackerHostRouteItem,
	repositories: ReadonlyMap<string, TrackerHostRepository>,
	node: string
) {
	const project = (item.project ?? item.agent)?.toLowerCase();
	const route = project
		? repositories.get(project)
		: [...repositories.values()].find(({ repo }) => item.repo === repo);
	if (!route || (item.repo && item.repo !== route.repo)) return undefined;
	return route.platform !== 'macos' || macNodes.has(node) ? route : undefined;
}

function pickHostModel(item: TrackerDispatchItem) {
	try {
		return pickTrackerModel(item);
	} catch {
		return { error: 'Tracker model cannot be selected for this task' };
	}
}
