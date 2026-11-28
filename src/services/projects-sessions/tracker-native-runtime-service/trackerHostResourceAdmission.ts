// @harness-uid u_2jymbzvxjz
import { homedir } from 'node:os';
import {
	trackerBudgetSessions,
	trackerCpuBudget,
	trackerHomeProject
} from '../../../utils/projects-sessions/trackerCpuBudget';
import { TrackerHostResourceAdapter } from '../../../adapters/projects-sessions/TrackerHostResourceAdapter';
import {
	trackerHostResourceHold,
	trackerResourceHoldPrefix
} from '../../../utils/projects-sessions/trackerHostResourceHold';
import type { TrackerHostResources } from '../../../utils/projects-sessions/trackerHostResources.types';
import type { TrackerDispatchItem } from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerHostLaunchConfig } from './nativeTrackerHostEffects.types';
import type { TrackerHostTarget } from './trackerHostLaunch.types';
import type { TrackerOccupiedRun } from './trackerHostAdmission.types';

/** Apply MB2's session budget, then this computer's RAM, disk, inode and load guards. */
export function trackerHostResourceAdmission(
	store: TrackerPersistenceService,
	config: TrackerHostLaunchConfig,
	{
		resources: provided,
		occupied
	}: { resources?: TrackerHostResources; occupied: () => TrackerOccupiedRun[] }
) {
	// A driver owns its own host; the managed launcher runs sessions on this computer.
	const resources =
		provided ?? ('managed' in config ? new TrackerHostResourceAdapter() : undefined);
	const budget = config.nonHarborSessionLimit ?? trackerBudgetSessions;
	const budgetHold = `${trackerResourceHoldPrefix}${budget}/${budget} non-Harbor sessions running`;
	return (item: TrackerDispatchItem, route: TrackerHostTarget): string | null => {
		const budgeted = Boolean(trackerCpuBudget(store.node, item.project ?? item.agent));
		if (budgeted && budgetedRuns(store, occupied()) >= budget) return budgetHold;
		if (!resources) return null;
		return trackerHostResourceHold(resources, {
			node: store.node,
			budgeted,
			paths: [homedir(), ...launchPaths(config, route)],
			limits: config
		});
	};
}

function launchPaths(config: TrackerHostLaunchConfig, route: TrackerHostTarget) {
	if ('workdir' in route) return [route.workdir];
	return 'managed' in config ? [route.repo, config.managed.stateDirectory] : [route.repo];
}

function budgetedRuns(store: TrackerPersistenceService, runs: TrackerOccupiedRun[]): number {
	const project = store.database.prepare(
		'SELECT coalesce(project, agent) AS name FROM items WHERE id = ?'
	);
	return runs.filter(({ itemId }) => {
		const row = project.get(itemId) as { name: string | null } | undefined;
		return row?.name?.trim().toLowerCase() !== trackerHomeProject;
	}).length;
}
