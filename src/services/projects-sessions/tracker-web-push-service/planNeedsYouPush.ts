// @harness-uid u_dqkisr3cq5
import { createHash } from 'node:crypto';
import { quietHourBoundary } from '../../../helpers/attention-timing/quietHourBoundary';
import { webPushContract } from '../../../utils/projects-sessions/webPushContract';
import type { PushQuietHours } from '../../../utils/projects-sessions/webPushContract.types';
import type { PushAsk, PushPlan, PushState } from './webPush.types';

const minute = 60_000;
export const pushRepeatMs = 15 * minute;
export const pushSpacingMs = minute;
/** A held notification asks the Hub again this often, so a changed setting takes effect. */
const recheckMs = 5 * minute;
const nobodyMs = minute;

export const emptyPushState = (): PushState => ({
	sent: [],
	lastSentAt: null,
	holdUntil: null,
	failures: 0,
	lastError: null
});

/** A new question on the same item is a new decision. */
export function pushAskKey(ask: PushAsk): string {
	const { itemId, question } = ask;
	return `${itemId}:${createHash('sha256').update(question).digest('hex').slice(0, 16)}`;
}

/**
 * Due when something is open and either never announced, announced 15 minutes ago, or new and
 * the last send is a minute old. Answered asks are forgotten, so asking again announces again.
 */
export function planNeedsYouPush(keys: string[], previous: PushState, now: number): PushPlan {
	const sent = previous.sent.filter((key) => keys.includes(key));
	const state = { ...previous, sent, ...(!keys.length && { holdUntil: null, failures: 0 }) };
	if (!keys.length || (state.holdUntil ?? 0) > now) return { state, due: false };
	if (state.lastSentAt === null) return { state, due: true };
	const waited = now - state.lastSentAt;
	const fresh = keys.some((key) => !sent.includes(key));
	return { state, due: waited >= pushRepeatMs || (fresh && waited >= pushSpacingMs) };
}

/** The state to hold when it is quiet now, or null when it may be sent. */
export function quietPushHold(
	state: PushState,
	quiet: PushQuietHours,
	now: number
): PushState | null {
	if (!quiet.enabled) return null;
	const end = quietHourBoundary(now, { ...quiet, tz: webPushContract.quietTimeZone });
	return end > now ? { ...state, holdUntil: Math.min(end, now + recheckMs) } : null;
}

/** No browser is subscribed: look again soon, so turning notifications on is felt at once. */
export function unheardPush(state: PushState, now: number): PushState {
	return { ...state, holdUntil: now + nobodyMs, failures: 0, lastError: null };
}

export function deliveredPush(keys: string[], now: number): PushState {
	return { ...emptyPushState(), sent: keys, lastSentAt: now };
}

/** One minute, doubling, never longer than the repeat interval. */
export function failedPush(state: PushState, error: string, now: number): PushState {
	const failures = state.failures + 1;
	const wait = Math.min(pushRepeatMs, minute * 2 ** Math.min(failures - 1, 5));
	return { ...state, failures, holdUntil: now + wait, lastError: error };
}
