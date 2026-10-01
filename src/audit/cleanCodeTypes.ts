import type { ChoiceQuestion } from '@typesafe-ai/sdk';

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

export interface JevChoice {
	type: 'choice';
	choice: string;
	confidence: number;
	probabilities: Record<string, number>;
}

export interface JevUsage {
	input_tokens: number;
	output_tokens: number;
}

export type JevQuestions = Record<string, ChoiceQuestion>;

export interface JevRequest {
	state: string;
	questions: JevQuestions;
}

export interface JevEvaluation {
	model: string;
	answers: Record<string, JevChoice>;
	usage: JevUsage;
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
