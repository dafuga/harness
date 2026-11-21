// @harness-uid u_76axmevkmg
import type { QuietHours } from './attentionTiming.types';
import { quietHourBoundary } from './quietHourBoundary';

/** @pure When the next interval reminder for an unanswered item is due: one interval after the last ping, held to the end of quiet hours. */
export function nextReminderAt(
	lastPingMs: number,
	intervalMs: number,
	quiet: QuietHours | null | undefined
): number {
	return quietHourBoundary(lastPingMs + intervalMs, quiet);
}
