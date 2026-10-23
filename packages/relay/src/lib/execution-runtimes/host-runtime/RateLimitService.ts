import type { RateStore } from './RateLimitService.types';
import { relayConfig } from '../../../configs/networking-security/relayConfig';
import type { RateBucket } from '../../../models/networking-security/RelayHost.types';

/** A fixed-window limit per host object and bucket. */
export class RateLimitService {
	constructor(private readonly store: RateStore) {}

	/**
	 * Counts one event. False once the window holds `limit` of them; an event that is refused is
	 * not written, so a flood costs no storage.
	 */
	hit(bucket: RateBucket, limit: number): boolean {
		const now = Date.now();
		const stored = this.store.rate(bucket);
		const current = stored && now - stored.startedAt < relayConfig.rateWindowMs;
		const window = current ? stored : { startedAt: now, count: 0 };
		if (window.count >= limit) return false;
		this.store.saveRate(bucket, { startedAt: window.startedAt, count: window.count + 1 });
		return true;
	}
}

export type { RateStore } from './RateLimitService.types';
