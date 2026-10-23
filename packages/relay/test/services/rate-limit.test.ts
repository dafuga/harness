import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { relayConfig } from '../../src/configs/relayConfig';
import type { RateBucket, RateRecord } from '../../src/models/RelayHost.types';
import { RateLimitService, type RateStore } from '../../src/services/RateLimitService';

/** Keeps windows the way a host object does, and counts what is written. */
function memoryStore(): RateStore & { writes: number } {
	const records = new Map<RateBucket, RateRecord>();
	return {
		writes: 0,
		rate: (bucket) => records.get(bucket),
		saveRate(bucket, record) {
			this.writes += 1;
			records.set(bucket, record);
		}
	};
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-10-12T10:00:00.000Z'));
});
afterEach(() => {
	vi.useRealTimers();
});

test('RateLimitService allows a window its limit and no more', () => {
	const limit = new RateLimitService(memoryStore());
	const answers = Array.from({ length: 5 }, () => limit.hit('pairing', 3));
	expect(answers).toEqual([true, true, true, false, false]);
});

test('RateLimitService starts again when the window is over', () => {
	const limit = new RateLimitService(memoryStore());
	expect([limit.hit('connect', 1), limit.hit('connect', 1)]).toEqual([true, false]);
	vi.advanceTimersByTime(relayConfig.rateWindowMs - 1);
	expect(limit.hit('connect', 1)).toBe(false);
	vi.advanceTimersByTime(1);
	expect([limit.hit('connect', 1), limit.hit('connect', 1)]).toEqual([true, false]);
});

test('RateLimitService counts each bucket on its own', () => {
	const limit = new RateLimitService(memoryStore());
	expect(limit.hit('connect', 1)).toBe(true);
	expect(limit.hit('connect', 1)).toBe(false);
	expect(limit.hit('pairing', 1)).toBe(true);
});

test('RateLimitService keeps its windows in the store, so they outlive the object', () => {
	const store = memoryStore();
	expect(new RateLimitService(store).hit('pairing', 2)).toBe(true);
	expect(new RateLimitService(store).hit('pairing', 2)).toBe(true);
	expect(new RateLimitService(store).hit('pairing', 2)).toBe(false);
});

test('RateLimitService writes nothing for an event it refuses', () => {
	const store = memoryStore();
	const limit = new RateLimitService(store);
	limit.hit('connect', 2);
	limit.hit('connect', 2);
	expect(store.writes).toBe(2);
	for (let index = 0; index < 50; index += 1) expect(limit.hit('connect', 2)).toBe(false);
	expect(store.writes).toBe(2);
});
