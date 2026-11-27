// @harness-uid u_qqw5gi3hpk
import type { HomeOpenAsk } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import type { NeedsTarget } from './hubHomeNeedsTarget.types';

/**
 * @pure Where a clicked notification lands. The named ask opens in Chief of Staff chat; anything
 * else shows the "Blocked - needs you" list. Home may still be reading, so it waits until the
 * ask or the list is there, or until it has waited long enough.
 */
export function needsTarget(
	needs: string | null,
	asks: readonly HomeOpenAsk[],
	waited: boolean
): NeedsTarget {
	if (!needs) return { kind: 'wait' };
	const ask = asks.find((entry) => entry.itemId === needs);
	if (ask) return { kind: 'ask', itemId: ask.itemId };
	if (needs === 'all' && asks.length) return { kind: 'list' };
	if (!waited) return { kind: 'wait' };
	return { kind: asks.length ? 'list' : 'none' };
}
