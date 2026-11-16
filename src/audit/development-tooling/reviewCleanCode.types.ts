// @harness-uid u_ioz2iepk5w
/* eslint-disable max-classes-per-file -- keep each workflow failure type beside its contract */
import type { CleanCodeSettings } from './cleanCodeTypes';
import type { CleanCodeOptions } from './cleanCodeTypes';
import type { FileReview } from './cleanCodeTypes';
import type { AuditFinding } from './types';
import type { JevEvaluator } from './cleanCodeEvaluate';
import type { ReviewSnapshot } from '../verification-evidence/cleanCodeSnapshot';

export class ReviewCancelledError extends Error {
	override name = 'ReviewCancelledError';
}

export class ReviewCredentialMissingError extends Error {
	override name = 'ReviewCredentialMissingError';
}

export class JevRequestFailedError extends Error {
	override name = 'JevRequestFailedError';
}

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
