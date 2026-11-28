// @harness-uid u_seba3xbna2
import { TrackerIgnoreExpiryRepository } from '../../../repositories/projects-sessions/TrackerIgnoreExpiryRepository';
import { planTrackerIgnoreExpiry } from '../../../utils/projects-sessions/planTrackerIgnoreExpiry';
import { trackerTimeZone } from '../../../utils/projects-sessions/normalizeTrackerDue';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';

/** The hub alone ends expired ignores, so each restore has one writer. */
export function composeTrackerIgnoreExpiry(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions
): (() => void) | undefined {
	const { role, now = Date.now, timeZone = trackerTimeZone } = options;
	if (role !== 'hub') return undefined;
	const repository = new TrackerIgnoreExpiryRepository(store);
	return () => {
		const clock = { now: now(), node: store.node, timeZone };
		repository.restore((item) => planTrackerIgnoreExpiry(item, clock));
	};
}
