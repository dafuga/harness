// @harness-uid u_4ds7oo3w22
import type { RealtimeState } from '$reports/lib/projects-sessions/realtime/realtime.types';

/** The screen being kept current: how to read it again, and where its link state shows. */
export interface FollowedScreen {
	refresh: () => Promise<unknown>;
	state: (state: RealtimeState) => void;
}
