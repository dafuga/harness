// @harness-uid u_bl6xl2h4a3
import type { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerHubSyncService } from '../TrackerHubSyncService';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { trackerHubDuePolicy } from './trackerAutolaunchAdmin';
import type { composeTrackerDispatch } from './nativeTrackerDispatch';

export function composeTrackerResponder(
	store: TrackerPersistenceService,
	runs: TrackerRunReadRepository,
	options: TrackerNativeRuntimeOptions,
	permits: Pick<ReturnType<typeof composeTrackerDispatch>, 'permitAutomatic' | 'permitDue'>
) {
	const { syncResponder, role, now = Date.now } = options;
	if (!syncResponder) return undefined;
	const duePolicy = role === 'hub' ? trackerHubDuePolicy(store, now) : undefined;
	return new TrackerHubSyncService({
		// A spoke's responder serves its Mac peer, which exchanges run history while the hub is down.
		runs: () => runs,
		duePolicy,
		...permits,
		...syncResponder,
		store
	});
}
