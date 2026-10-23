import type { JevEvaluation } from './cleanCodeTypes';

export interface CachedEvaluation {
	evaluation: JevEvaluation;
	localization?: JevEvaluation;
}
