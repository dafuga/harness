// @harness-uid u_bl6xl2h4a3
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import {
	clearTrackerQuotaHold,
	trackerProviderHold,
	trackerProviders
} from './trackerProviderHolds';

export const duePauseKey = 'due_scheduler_paused';

/** The operator's launch switches for this computer. */
export function trackerAutolaunchAdmin(
	store: TrackerPersistenceService,
	{ role, now }: { role: 'hub' | 'spoke'; now: () => number }
) {
	return {
		pauseDue(paused: boolean) {
			if (role !== 'hub')
				throw trackerItemError('run tracker autolaunch pause or resume on the hub', 409);
			store.writeMeta({ [duePauseKey]: paused ? '1' : '0' });
			return { paused };
		},
		clearQuota(provider: unknown) {
			const cli = trackerProviders.find((name) => name === provider);
			if (!cli) throw trackerItemError('quota provider must be codex or claude', 400);
			clearTrackerQuotaHold(store, cli);
			return {
				provider: cli,
				cleared: true,
				waiting_on: trackerProviderHold(store, cli, now())
			};
		}
	};
}

/** What the hub tells each spoke with every journal pull. */
export function trackerHubDuePolicy(store: TrackerPersistenceService, now: () => number) {
	return () => ({ paused: store.getMeta(duePauseKey) === '1', at: now() });
}
