// @harness-uid u_ey52fkjjk2
import type { AttentionBatchTiming } from './attentionTiming.types';
import { quietHourBoundary } from './quietHourBoundary';

/**
 * @pure When the next Chief of Staff batch may go out, or null when nothing is queued or paused.
 * One batch per window: the first queued line starts a window of windowMs (launch-wait holds snap to the
 * next window boundary), and a send never comes sooner than windowMs after the last attempt. Urgent kinds
 * send now; forced catch-up sends now without quiet hours; otherwise quiet hours hold the send to their end.
 */
export function nextAttentionBatchAt(timing: AttentionBatchTiming): number | null {
	const { pending, paused, forced, nowMs, windowMs } = timing;
	if (!pending.length || paused) return null;
	if (forced) return nowMs;
	const first = pending[0];
	const urgent = pending.some((line) => timing.urgentKinds.includes(line.kind));
	const windowStart = timing.windowAlignedKinds.includes(first.kind)
		? Math.ceil(first.createdAtMs / windowMs) * windowMs
		: first.createdAtMs + windowMs;
	const sinceLastAttempt =
		timing.lastAttemptMs === null ? -Infinity : timing.lastAttemptMs + windowMs;
	const at = urgent ? nowMs : Math.max(windowStart, sinceLastAttempt);
	return timing.quietHold ? quietHourBoundary(at, timing.quiet) : at;
}
