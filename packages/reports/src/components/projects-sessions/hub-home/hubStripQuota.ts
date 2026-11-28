// @harness-uid u_lttwnjwv4v
import type { HomeSubscription } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import type { StripQuota } from './hubStripQuota.types';

/** @pure Exactly two entries, Claude then Codex, whatever the readings hold. */
export function stripQuota(subscriptions: HomeSubscription[] | null, now: number): StripQuota[] {
	throw new Error(`stripQuota is not built yet (${subscriptions?.length ?? 0} at ${now})`);
}
