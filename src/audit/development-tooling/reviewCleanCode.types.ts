import type { CleanCodeSettings } from './cleanCodeTypes';
import type { CleanCodeOptions } from './cleanCodeTypes';
import type { FileReview } from './cleanCodeTypes';
import type { AuditFinding } from './types';
import type { JevEvaluator } from './cleanCodeEvaluate';
import type { ReviewSnapshot } from '../verification-evidence/cleanCodeSnapshot';

export interface ReviewCleanCodeInput {
	root: string;
	settings: CleanCodeSettings;
	options?: CleanCodeOptions;
	findings?: AuditFinding[];
	evaluate?: JevEvaluator;
}

export interface ReviewedEntry {
	result: FileReview;
	snapshot?: ReviewSnapshot;
}
