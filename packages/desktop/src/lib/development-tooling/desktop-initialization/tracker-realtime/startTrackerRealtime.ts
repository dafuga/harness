// @harness-uid u_3ypqfc5fm2
import type { TrackerChangeEvent } from '$reports/lib/projects-sessions/realtime/realtime.types';
import type { TrackerOverviewPublisher } from '../tracker-overview-publisher/TrackerOverviewPublisher';
import type { TrackerOverviewAuthority } from '../tracker-overview-publisher/TrackerOverviewPublisher.types';
import { followHubChat } from './followHubChat';
import { TrackerChangeWatcher } from './TrackerChangeWatcher';

/**
 * Everything that makes a change show at once on this Mac: the local tracker's pushes reach the
 * window and the Hub publisher, and a message queued on another device wakes the publisher.
 */
export function startTrackerRealtime(options: {
	publisher: TrackerOverviewPublisher | null;
	authority?: TrackerOverviewAuthority;
	env: Record<string, string | undefined>;
	emit: (event: TrackerChangeEvent) => void;
}): () => void {
	const { publisher, authority, env, emit } = options;
	const watcher = new TrackerChangeWatcher((event) => {
		emit(event);
		if (event.changed) publisher?.nudge();
	}).start();
	const owner = env.HARNESS_TRACKER_OVERVIEW_OWNER_ACTOR_ID?.trim();
	const hub =
		publisher && authority && owner && env.HARNESS_HUB_HOME_PUBLISH === '1'
			? followHubChat(authority, owner, () => publisher.nudge())
			: undefined;
	return () => {
		watcher.stop();
		hub?.stop();
	};
}
