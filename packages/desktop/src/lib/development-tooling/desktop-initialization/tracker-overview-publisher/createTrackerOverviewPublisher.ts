// @harness-uid u_p43nh5e4yc
import { overviewProviderBudgets } from '$reports/lib/projects-sessions/hub-home/homeProviderPayload';
import { createHomeProviderReader } from './homeProviderReader';
import { createHubHomePublisher } from './createHubHomePublisher';
import type { TrackerOverviewFactoryInput } from './TrackerOverviewPublisher.types';
import { TrackerOverviewPublisher } from './TrackerOverviewPublisher';
import { readProjectOverview } from '$reports/lib/projects-sessions/project-overview/readProjectOverview';

/**
 * The background publisher when it is opted in and a verified Hub connection exists; otherwise
 * null. The default read is the shared fixed local tracker GET.
 */
export function createTrackerOverviewPublisher(
	input: TrackerOverviewFactoryInput
): TrackerOverviewPublisher | null {
	const ownerActorId = input.env.HARNESS_TRACKER_OVERVIEW_OWNER_ACTOR_ID?.trim();
	if (!input.authority || input.env.HARNESS_TRACKER_OVERVIEW_PUBLISH !== '1' || !ownerActorId)
		return null;
	const providers = createHomeProviderReader(input.env.HARNESS_HUB_HOME_PROVIDER_FILE);
	return new TrackerOverviewPublisher({
		authority: input.authority,
		ownerActorId,
		read: async () => {
			const now = Date.now();
			const snapshot = await (input.read?.() ?? readProjectOverview(fetch, now));
			if (snapshot.status !== 'ready') return snapshot;
			const readings = await providers(now);
			return { ...snapshot, providerBudgets: overviewProviderBudgets(readings.quota, now) };
		},
		publishHome:
			input.env.HARNESS_HUB_HOME_PUBLISH === '1' ? createHubHomePublisher(providers) : undefined
	});
}
