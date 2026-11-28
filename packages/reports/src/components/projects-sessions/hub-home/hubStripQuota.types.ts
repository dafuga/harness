// @harness-uid u_lttwnjwv4v
import type { StripTone } from './hubStripComputers.types';

/** One subscription limit in the stats strip: share left, a bar and when it resets. */
export interface StripQuota {
	provider: 'claude' | 'codex';
	name: 'Claude' | 'Codex';
	/** The limit window shown beside the name: "5 hour" for Claude, "weekly" for Codex. */
	window: string;
	/** Whole percent left, 0 to 100; null when there is no fresh reading. */
	left: number | null;
	tone: Exclude<StripTone, 'done'>;
	/** Text after the share, such as "resets 21:10", or "No recent reading". */
	resets: string;
}
