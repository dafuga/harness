import type { ReasonStatus } from '../../core/development-tooling/explanationTypes';
import type { Explanation } from '../../core/development-tooling/explanationTypes';
import type { RequiredReason } from '../../core/development-tooling/explanationTypes';

export interface ReasonReport {
	required: ReasonStatus[];
	/** The reasons that satisfy a requirement, in requirement order. */
	entries: Explanation[];
	/** Changes whose reason exceeds the writing limits: explained, and open to a shorter reason. */
	overlong: RequiredReason[];
	failures: string[];
}

export type Fingerprint = Explanation['from'];
