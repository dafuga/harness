// @harness-uid u_a3ytqsxx4a
import type { JevEvaluation } from './cleanCodeTypes';

export interface CachedEvaluation {
	evaluation: JevEvaluation;
	localization?: JevEvaluation;
}

/** A cache directory or nearest existing ancestor that resolves outside the project root. */
export class CacheOutsideProjectError extends Error {
	override name = 'CacheOutsideProjectError';
}
