// @harness-uid u_t6m3x5hbzq
import type { HomeSubscription } from '$reports/lib/projects-sessions/hub-home/hubHome.types';

export interface CodexWindow {
	usedPercent: number;
	windowDurationMins?: number | null;
	resetsAt?: number | null;
}

/** The part of `account/rateLimits/read` that Home shows. Fields the Codex CLI adds later are ignored. */
export interface CodexRateLimits {
	planType?: string | null;
	primary?: CodexWindow | null;
	secondary?: CodexWindow | null;
	credits?: { hasCredits: boolean; unlimited: boolean; balance?: string | null } | null;
}

export type QuotaSource = (now: number) => Promise<HomeSubscription | null>;
