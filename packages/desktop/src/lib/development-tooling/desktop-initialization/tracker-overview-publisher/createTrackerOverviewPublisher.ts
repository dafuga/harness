// @harness-uid u_p43nh5e4yc
import { createHubHomePublisher } from './createHubHomePublisher';
import { liveQuotaSources } from './liveQuotaSources';
import type { TrackerOverviewFactoryInput } from './TrackerOverviewPublisher.types';
import { TrackerOverviewPublisher } from './TrackerOverviewPublisher';
import { getTrackerJson } from '$reports/lib/projects-sessions/project-overview/trackerJsonRead';
import { TRACKER_GET_URLS } from '$reports/lib/projects-sessions/project-overview/trackerReadTargets';
import type { OverviewSnapshot } from '$reports/lib/projects-sessions/project-overview/projectOverview.types';
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
	const publisher = new TrackerOverviewPublisher({
		authority: input.authority,
		ownerActorId,
		read: input.read ?? readOwnerOverview,
		publishHome:
			input.env.HARNESS_HUB_HOME_PUBLISH === '1'
				? createHubHomePublisher(input.env.HARNESS_HUB_HOME_PROVIDER_FILE, liveQuotaSources())
				: undefined
	});
	return publisher;
}

async function readOwnerOverview(): Promise<OverviewSnapshot> {
	const [snapshot, rules] = await Promise.all([
		readProjectOverview(),
		getTrackerJson(fetch, TRACKER_GET_URLS.sessionRules).catch(() => null)
	]);
	return snapshot.status === 'ready' && Array.isArray(rules)
		? { ...snapshot, sessionRules: rules }
		: snapshot;
}
