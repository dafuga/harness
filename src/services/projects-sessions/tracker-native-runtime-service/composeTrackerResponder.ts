// @harness-uid u_bl6xl2h4a3
import { trackerLandingAuthority } from '../tracker-hub-sync/trackerLandingQueue';
import { trackerAreaAuthority } from '../tracker-hub-sync/trackerAreaClaim';
import type { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerHubSyncService } from '../TrackerHubSyncService';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerNativeRuntimeService } from '../TrackerNativeRuntimeService';
import { trackerHubMachines } from './nativeTrackerLinks';
import { trackerHubDuePolicy } from './trackerAutolaunchAdmin';
import type { composeTrackerDispatch } from './nativeTrackerDispatch';

export function composeTrackerResponder(
	runtime: Pick<TrackerNativeRuntimeService, 'store' | 'machines'>,
	runs: TrackerRunReadRepository,
	options: TrackerNativeRuntimeOptions,
	composed: Pick<
		ReturnType<typeof composeTrackerDispatch>,
		'permitAutomatic' | 'permitDue' | 'scheduler'
	>
) {
	const { store, machines } = runtime;
	const { syncResponder, role, now = Date.now } = options;
	if (!syncResponder) return undefined;
	const duePolicy = role === 'hub' ? trackerHubDuePolicy(store, now) : undefined;
	const { scheduler, ...permits } = composed;
	return new TrackerHubSyncService({
		// A spoke's responder serves its Mac peer, which exchanges run history while the hub is down.
		runs: () => runs,
		duePolicy,
		...permits,
		...syncResponder,
		landing: role === 'hub' ? trackerLandingAuthority(store, now) : undefined,
		claimAreas: role === 'hub' ? trackerAreaAuthority(store) : undefined,
		machines:
			syncResponder.machines &&
			trackerHubMachines(syncResponder.machines, runs, options, { machines, scheduler }),
		store
	});
}
