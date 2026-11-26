// @harness-uid u_bl6xl2h4a3
import type { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerHubSyncService } from '../TrackerHubSyncService';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { trackerHubMachines } from './nativeTrackerLinks';
import { trackerHubDuePolicy } from './trackerAutolaunchAdmin';
import type { composeTrackerDispatch } from './nativeTrackerDispatch';

export function composeTrackerResponder(
	store: TrackerPersistenceService,
	runs: TrackerRunReadRepository,
	options: TrackerNativeRuntimeOptions,
	composed: Pick<
		ReturnType<typeof composeTrackerDispatch>,
		'permitAutomatic' | 'permitDue' | 'scheduler'
	>
) {
	const { syncResponder, role, now = Date.now } = options;
	if (!syncResponder) return undefined;
	const runStore = role === 'hub' ? () => runs : undefined;
	const duePolicy = role === 'hub' ? trackerHubDuePolicy(store, now) : undefined;
	const { scheduler, ...permits } = composed;
	return new TrackerHubSyncService({
		runs: runStore,
		duePolicy,
		...permits,
		...syncResponder,
		machines:
			syncResponder.machines &&
			trackerHubMachines(syncResponder.machines, runs, options, scheduler),
		store
	});
}
