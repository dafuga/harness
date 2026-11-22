// @harness-uid u_wwerrde2nk
import type { AgentEvaluator } from '../agents-providers/evaluateAgent.types';
import type { BugClass } from '../../core/development-tooling/bug-class/bugClassSchemas.types';
import type { ReviewedCandidate } from './sibling-bug-sweep/scanCandidates.types';

export interface BugSweepInput {
	root: string;
	revision?: string;
	report?: string;
	classId?: string;
	origin?: { path: string; line: number };
	model: string;
	reviewLimit: number;
}

export interface BugSweepReport {
	schemaVersion: 1;
	revision: string;
	bugClass: BugClass;
	model: string;
	scannedFiles: number;
	skipped: string[];
	candidates: ReviewedCandidate[];
	errors: string[];
}

export interface SweepReviewInput {
	root: string;
	base: string;
	revision?: string;
	model: string;
	reviewLimit: number;
}

export type BugEvaluator = AgentEvaluator;
