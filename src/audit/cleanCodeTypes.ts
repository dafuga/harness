import type { JevChoice, JevUsage } from '../core/jevTypes';
export type {
	JevChoice,
	JevUsage,
	JevQuestions,
	JevRequest,
	JevEvaluation
} from '../core/jevTypes';

export type CleanCodeMode = 'off' | 'advisory' | 'gate';
export type CleanCodeVerdict = 'meets' | 'violates' | 'not_applicable' | 'insufficient_context';
export type ReviewStatus = 'clean' | 'violations' | 'needs-review' | 'incomplete';

export interface CleanCodeConfig {
	mode?: CleanCodeMode;
	model?: string;
	minConfidence?: number;
	apiKeyEnv?: string;
	exclude?: string[];
}

export interface CleanCodeSettings {
	mode: CleanCodeMode;
	model: string;
	minConfidence: number;
	apiKeyEnv: string;
	exclude: string[];
}

export interface CleanCodeOptions {
	enabled?: boolean;
	gate?: boolean;
	dryRun?: boolean;
	refresh?: boolean;
	signal?: AbortSignal;
}

export interface ReviewLocation {
	startLine: number;
	endLine: number;
	excerpt: string;
}

export interface PrincipleAssessment extends JevChoice {
	principle: string;
	title: string;
	guidance: string;
	status: 'meets' | 'violates' | 'not-applicable' | 'needs-review';
	location?: ReviewLocation;
}

export interface FileReview {
	path: string;
	contentHash: string;
	contextHash: string;
	status: ReviewStatus;
	assessments: PrincipleAssessment[];
	contextPaths: string[];
	omittedContext: string[];
	model?: string;
	usage: JevUsage;
	cached: boolean;
	error?: string;
}

export interface ReviewCoverage {
	selectedFiles: string[];
	excludedPaths: Array<{ path: string; reason: string }>;
	unsupportedFiles: string[];
}

export interface CleanCodeReport {
	mode: CleanCodeMode;
	status: ReviewStatus | 'dry-run' | 'not-applicable';
	rubricVersion: string;
	requestedModel: string;
	minConfidence: number;
	coverage: ReviewCoverage;
	files: FileReview[];
	usage: JevUsage;
}
