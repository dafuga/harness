import { expect, test } from 'vitest';
import { nextAttentionBatchAt } from '../../../src/helpers/attention-timing/nextAttentionBatchAt';
import type { AttentionBatchTiming } from '../../../src/helpers/attention-timing/attentionTiming.types';

const MIN = 60e3;
const LISBON = { tz: 'Europe/Lisbon', start: '22:00', end: '08:00' };
const at = (iso: string) => Date.parse(iso);

function timing(overrides: Partial<AttentionBatchTiming> = {}): AttentionBatchTiming {
	return {
		nowMs: at('2026-11-17T10:00:00Z'),
		windowMs: 30 * MIN,
		paused: false,
		forced: false,
		lastAttemptMs: null,
		pending: [{ kind: 'done', createdAtMs: at('2026-11-17T10:01:00Z') }],
		urgentKinds: [],
		windowAlignedKinds: ['launch_wait'],
		quietHold: true,
		quiet: LISBON,
		...overrides
	};
}

test('nextAttentionBatchAt is null when nothing is queued or while paused', () => {
	expect(nextAttentionBatchAt(timing({ pending: [] }))).toBeNull();
	expect(nextAttentionBatchAt(timing({ paused: true }))).toBeNull();
});

test('the window opens at the first queued line and sends 30 minutes later', () => {
	expect(nextAttentionBatchAt(timing())).toBe(at('2026-11-17T10:31:00Z'));
});

test('a later line never shortens the window, and a send waits 30 minutes after the last attempt', () => {
	const pending = [
		{ kind: 'done', createdAtMs: at('2026-11-17T10:01:00Z') },
		{ kind: 'blocked', createdAtMs: at('2026-11-17T10:20:00Z') }
	];
	expect(nextAttentionBatchAt(timing({ pending }))).toBe(at('2026-11-17T10:31:00Z'));
	expect(nextAttentionBatchAt(timing({ pending, lastAttemptMs: at('2026-11-17T10:31:00Z') }))).toBe(
		at('2026-11-17T11:01:00Z')
	);
});

test('a launch wait snaps to the next window boundary instead of starting its own window', () => {
	const pending = [{ kind: 'launch_wait', createdAtMs: at('2026-11-17T10:05:00Z') }];
	expect(nextAttentionBatchAt(timing({ pending }))).toBe(at('2026-11-17T10:30:00Z'));
});

test('forced catch-up sends now, even inside quiet hours', () => {
	const nowMs = at('2026-11-17T23:00:00Z');
	expect(nextAttentionBatchAt(timing({ nowMs, forced: true }))).toBe(nowMs);
});

test('an urgent kind sends now, but quiet hours still hold it', () => {
	const pending = [{ kind: 'needs_daniel', createdAtMs: at('2026-11-17T10:01:00Z') }];
	const nowMs = at('2026-11-17T10:02:00Z');
	expect(nextAttentionBatchAt(timing({ pending, nowMs, urgentKinds: ['needs_daniel'] }))).toBe(
		nowMs
	);
	const night = at('2026-11-17T22:30:00Z');
	expect(
		nextAttentionBatchAt(timing({ pending, nowMs: night, urgentKinds: ['needs_daniel'] }))
	).toBe(at('2026-11-18T08:00:00Z'));
});

test('a window that ends in quiet hours is held to 08:00; quietHold off ignores quiet hours', () => {
	const pending = [{ kind: 'done', createdAtMs: at('2026-11-17T21:40:00Z') }];
	expect(
		nextAttentionBatchAt(timing({ pending, nowMs: at('2026-11-17T21:41:00Z'), quietHold: true }))
	).toBe(at('2026-11-18T08:00:00Z'));
	expect(
		nextAttentionBatchAt(timing({ pending, nowMs: at('2026-11-17T21:41:00Z'), quietHold: false }))
	).toBe(at('2026-11-17T22:10:00Z'));
});
