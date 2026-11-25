// @harness-uid u_xyoozv6qf7
import { buildHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/homeTrackerProjection';
import type { OwnerHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { readTrackerSources } from '$reports/lib/projects-sessions/project-overview/projectOverviewTracker';
import type { QuotaSource } from './codexQuotaSource';
import { createHomeProviderReader } from './homeProviderReader';

/**
 * What this Mac answers when a device of the signed-in account asks for its Home view: the
 * Tracker work and sessions running here, and the provider quota it knows. It is read when asked
 * and travels only over the encrypted device connection, never through a stored copy.
 */
export function createHomeSnapshotReader(providerFile?: string, sources?: QuotaSource[]) {
	const providers = createHomeProviderReader(providerFile, sources);
	return async (): Promise<OwnerHomeSnapshot> => {
		const now = Date.now();
		const [readings, sources] = await Promise.all([
			providers(now),
			readTrackerSources(fetch, true).catch(() => null)
		]);
		return buildHomeSnapshot(sources, readings, now);
	};
}
