// @harness-uid u_p43nh5e4yc
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
	return new TrackerOverviewPublisher({
		authority: input.authority,
		ownerActorId,
		read: input.read ?? (() => readProjectOverview())
	});
}
