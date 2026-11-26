// @harness-uid u_4ds7oo3w22
import { coalesced } from '$reports/lib/projects-sessions/realtime/coalesced';
import type { RealtimeState } from '$reports/lib/projects-sessions/realtime/realtime.types';
import type { TrackerInboxSource } from '../../../models/development-tooling/TrackerInbox.types';

/** How often the screen reads for itself while pushes are not arriving. */
export const fallbackPollMs = 15_000;

/** The screen being kept current: how to read it again, and where its link state shows. */
export interface FollowedScreen {
	refresh: () => Promise<unknown>;
	state: (state: RealtimeState) => void;
}

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
	const stop = source.watch(({ state }) => {
		screen.state(state);
		if (state === 'live') {
			clearInterval(poll);
			poll = undefined;
			// A push says something moved, or the link is back after a gap it cannot describe.
			void refresh();
		} else poll ??= setInterval(() => void refresh(), pollMs);
	});
	return () => {
		clearInterval(poll);
		stop();
	};
}
