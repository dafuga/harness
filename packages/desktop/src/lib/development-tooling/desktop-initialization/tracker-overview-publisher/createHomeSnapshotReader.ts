// @harness-uid u_xyoozv6qf7
import { buildHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/homeTrackerProjection';
import type { OwnerHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { readTrackerSources } from '$reports/lib/projects-sessions/project-overview/projectOverviewTracker';
import { SubscriptionQuotaService } from '../../../../../../../src/services/agents-providers/SubscriptionQuotaService';
import { createHomeProviderReader } from './homeProviderReader';

const localQuota = new SubscriptionQuotaService();

/**
 * What this Mac answers when a device of the signed-in account asks for its Home view: the
 * Tracker work and sessions running here, and the provider quota it knows. It is read when asked
 * and travels only over the encrypted device connection, never through a stored copy.
 */
export function createHomeSnapshotReader(providerFile?: string) {
	const providers = createHomeProviderReader(providerFile);
	return async (): Promise<OwnerHomeSnapshot> => {
		const now = Date.now();
		const [readings, sources, quota] = await Promise.all([
			providers(now),
			readTrackerSources(fetch, true).catch(() => null),
			localQuota.read(now, 2500)
		]);
		const manual = readings.quota?.filter(
			(row) => !quota.some((live) => live.provider === row.provider)
		);
		return buildHomeSnapshot(
			sources,
			{
				...readings,
				quota: quota.length ? [...quota, ...(manual ?? [])] : readings.quota
			},
			now
		);
	};
}
