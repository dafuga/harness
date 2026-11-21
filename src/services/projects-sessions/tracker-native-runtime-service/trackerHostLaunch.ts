// @harness-uid u_bl6xl2h4a3
import { TrackerHostProcessAdapter } from '../../../adapters/projects-sessions/TrackerHostProcessAdapter';
import { canonicalNode } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import { TrackerTmuxAdapter } from '../../../adapters/projects-sessions/TrackerTmuxAdapter';
import {
	pickTrackerModel,
	retryTrackerModel
} from '../../../utils/agents-providers/pickTrackerModel';
import type { TrackerLaunchRung } from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type {
	TrackerHostLaunchConfig,
	TrackerHostRepository
} from './nativeTrackerHostEffects.types';
import type { TrackerHostRouteItem, TrackerHostSession } from './trackerHostLaunch.types';
import { trackerHostRunner } from './trackerHostRunner';

const macNodes = new Set(['daniel-primary-mbp', 'harbor-mbp-2']);

export function trackerHostLaunch(
	store: TrackerPersistenceService,
	config: TrackerHostLaunchConfig,
	tmuxExecutable?: string
): NonNullable<TrackerNativeRuntimeOptions['dispatch']> {
	const driver = new TrackerHostProcessAdapter(config.driver);
	const node = canonicalNode(store.node, {});
	const repositories = new Map(
		Object.entries(config.repositories).map(([project, route]) => [project.toLowerCase(), route])
	);
	const routeFor = (item: TrackerHostRouteItem) => approvedRoute(item, repositories, node);
	const tmux = tmuxExecutable
		? new TrackerTmuxAdapter({ executable: tmuxExecutable, node })
		: undefined;
	const host = trackerHostRunner(store, driver, routeFor, tmux);
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
			admit: (item, _, rung) => launchHold(routeFor(item), host.inventory(), rung, store),
			pickModel(item) {
				try {
					return pickTrackerModel(item);
				} catch {
					return { error: 'Tracker model cannot be selected for this task' };
				}
			},
			retryModel: retryTrackerModel
		},
		scheduleDue: config.due === true,
		due: () => ({
			enabled: config.due === true,
			paused: false,
			localDue: true,
			adapterDue: config.due === true
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

function launchHold(
	route: TrackerHostRepository | undefined,
	sessions: readonly TrackerHostSession[],
	rung: TrackerLaunchRung | null,
	store: TrackerPersistenceService
): string | null {
	if (!route) return 'no approved Tracker repository or platform for this node';
	if (hasHostCapacityHold(store, sessions)) return 'Tracker host is at session capacity';
	if (rung && !['codex', 'claude'].includes(rung.cli)) return 'no supported Tracker provider';
	return null;
}

function hasHostCapacityHold(
	store: TrackerPersistenceService,
	sessions: readonly TrackerHostSession[]
): boolean {
	const { reserved } = store.database
		.prepare(
			`SELECT count(*) AS reserved FROM runs r
		LEFT JOIN meta m ON m.k = 'harness_dispatch_run:' || r.id
		WHERE r.state IN ('running','verifying')
		OR (r.state = 'queued' AND json_extract(m.v, '$.dispatch_at') IS NOT NULL)`
		)
		.get() as { reserved: number };
	return Math.max(reserved, sessions.filter(({ state }) => state === 'live').length) >= 2;
}
