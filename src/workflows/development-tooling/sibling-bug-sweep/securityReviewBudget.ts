// @harness-uid u_wwerrde2nk
import { fail } from '../../../core/development-tooling/errors';
import type { SecurityReviewLimits } from './securityReviewBudget.types';

/** Hold each reviewer's maximum charge for the life of this run, even on failure. */
export class SecurityReviewBudget {
	readonly signal: AbortSignal;
	private readonly deadline: number;
	private reservedMicrousd = 0;

	constructor(private readonly limits: SecurityReviewLimits) {
		if (
			!Number.isSafeInteger(limits.maxDurationMs) ||
			limits.maxDurationMs < 1 ||
			limits.maxDurationMs > 2_147_483_647 ||
			!Number.isSafeInteger(limits.maxCostMicrousd) ||
			limits.maxCostMicrousd < 0
		)
			fail('Invalid security review limits.');
		this.deadline = performance.now() + limits.maxDurationMs;
		this.signal = AbortSignal.timeout(limits.maxDurationMs);
	}

	checkTime(): void {
		if (this.timeExpired()) fail('Security review time cap reached.');
	}

	timeExpired(): boolean {
		return this.signal.aborted || performance.now() >= this.deadline;
	}

	reserve(maximumMicrousd: number): boolean {
		this.checkTime();
		if (!Number.isSafeInteger(maximumMicrousd) || maximumMicrousd <= 0)
			fail('The reviewer needs a verified positive maximum charge.');
		if (maximumMicrousd > this.limits.maxCostMicrousd - this.reservedMicrousd) return false;
		this.reservedMicrousd += maximumMicrousd;
		return true;
	}

	summary() {
		return { ...this.limits, reservedMicrousd: this.reservedMicrousd };
	}
}
