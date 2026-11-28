// @harness-uid u_2jymbzvxjz
import { homedir } from 'node:os';
import {
	trackerBudgetNode,
	trackerHomeProject
} from '../../../utils/projects-sessions/trackerCpuBudget';
import {
	trackerHostResourceHold,
	trackerResourceHoldPrefix
} from '../../../utils/projects-sessions/trackerHostResourceHold';
import {
	trackerMacRole,
	trackerMacSessionMemoryReservePercent,
	trackerMacSessionRamSlots,
	trackerMachineRole
} from '../../../utils/projects-sessions/trackerMachineStatus';
import type { TrackerHostResources } from '../../../utils/projects-sessions/trackerHostResources.types';
import type { TrackerDispatchItem } from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerHostLaunchConfig } from './nativeTrackerHostEffects.types';
import type { TrackerHostTarget } from './trackerHostLaunch.types';
import type { TrackerOccupiedRun } from './trackerHostAdmission.types';

/** Apply configured limits and check the local launch filesystems. */
export function trackerHostResourceAdmission(
	store: TrackerPersistenceService,
	config: TrackerHostLaunchConfig,
	{
		resources,
		occupied
	}: { resources?: TrackerHostResources; occupied: () => TrackerOccupiedRun[] }
) {
	const budget = config.nonHarborSessionLimit;
	return (item: TrackerDispatchItem, route: TrackerHostTarget): string | null => {
		const project = (item.project ?? item.agent)?.trim().toLowerCase();
		if (budget && trackerBudgetNode(store.node) && project !== trackerHomeProject) {
			if (budgetedRuns(store, occupied()) >= budget)
				return `${trackerResourceHoldPrefix}${budget}/${budget} non-Harbor sessions running`;
		}
		if (!resources) return null;
		const hold = trackerHostResourceHold(resources, {
			node: store.node,
			paths: [homedir(), ...launchPaths(config, route)],
			limits: config
		});
		if (hold) return hold;
		return trackerHostRamSlots(store.node, resources) < 1
			? `${trackerResourceHoldPrefix}RAM available above the ${trackerMacSessionMemoryReservePercent}% reserve is under 1 GiB`
			: null;
	};
}

export function trackerHostRamSlots(node: string, resources?: TrackerHostResources): number {
	if (!resources || !trackerMacRole(trackerMachineRole(node))) return Infinity;
	const { availableMB, freePercent } = resources.memory();
	return trackerMacSessionRamSlots(availableMB, freePercent);
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
