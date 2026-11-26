// @harness-uid u_4ds7oo3w22
import { coalesced } from '$reports/lib/projects-sessions/realtime/coalesced';
import type { TrackerInboxSource } from '../../../models/development-tooling/TrackerInbox.types';
import type { FollowedScreen } from './followTrackerSource.types';
export type { FollowedScreen } from './followTrackerSource.types';

/** How often the screen reads for itself while pushes are not arriving. */
export const fallbackPollMs = 15_000;

/**
 * Keeps a screen current: reads again on every pushed change and on every reconnect, and polls
 * slowly only while the link is down. A source that cannot push is left alone.
 */
export function followTrackerSource(
	source: TrackerInboxSource,
	screen: FollowedScreen,
	pollMs: number = fallbackPollMs
): () => void {
	if (!source.watch) return () => undefined;
	const refresh = coalesced(screen.refresh);
	let poll: ReturnType<typeof setInterval> | undefined;
	const stop = source.watch(({ state, changed }) => {
		screen.state(state);
		if (state === 'live') {
			clearInterval(poll);
			poll = undefined;
		} else poll ??= setInterval(() => void refresh(), pollMs);
		// A push says something moved, or the link is back after a gap it cannot describe. A
		// source with its own copy can also move that copy while pushes are down.
		if (state === 'live' || changed) void refresh();
	});
	return () => {
		clearInterval(poll);
		stop();
	};
}
