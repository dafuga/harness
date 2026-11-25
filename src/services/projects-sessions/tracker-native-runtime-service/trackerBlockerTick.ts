// @harness-uid u_bl6xl2h4a3
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { syncTrackerBlockers } from '../tracker-local-api-service/trackerLocalBlockers';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';

const syncEvery = 10 * 60_000;

/** On the Chief of Staff computer, apply the Blockers inbox rules at most every ten minutes. */
export function trackerBlockerTick(
	ports: { store: TrackerPersistenceService; items: TrackerItemReadRepository },
	options: { enabled: boolean; now: () => number }
): () => void {
	let last = -Infinity;
	return () => {
		const { enabled, now } = options;
		if (!enabled || now() - last < syncEvery) return;
		last = now();
		syncTrackerBlockers({ ...ports, options: { now } }, 'blocker-inbox');
	};
}
