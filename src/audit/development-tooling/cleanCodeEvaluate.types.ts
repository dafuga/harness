import type { JevRequest } from './cleanCodeTypes';
import type { JevEvaluation } from './cleanCodeTypes';
import type { CleanCodeSettings } from './cleanCodeTypes';
import type { CleanCodeOptions } from './cleanCodeTypes';
import type { JevUsage } from './cleanCodeTypes';
import type { ReviewSnapshot } from '../verification-evidence/cleanCodeSnapshot';

export type JevEvaluator = (request: JevRequest, signal?: AbortSignal) => Promise<JevEvaluation>;

export interface EvaluationInput {
	root: string;
	snapshot: ReviewSnapshot;
	settings: CleanCodeSettings;
	options: CleanCodeOptions;
	evaluate: JevEvaluator;
	onUsage?: (usage: JevUsage) => void;
}
