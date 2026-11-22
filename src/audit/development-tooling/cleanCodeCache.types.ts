// @harness-uid u_a3ytqsxx4a
import type { JevEvaluation } from './cleanCodeTypes';

export interface CachedEvaluation {
	evaluation: JevEvaluation;
	localization?: JevEvaluation;
}

export { CacheOutsideProjectError } from './CacheOutsideProjectError';
