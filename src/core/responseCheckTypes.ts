import type { JevChoice, JevUsage } from './jevTypes';

export interface ResponseCriterion {
	id: string;
	description: string;
}
export interface ResponseCheckOptions {
	request?: string;
	response?: string;
	context?: string;
	criteria?: string;
	model?: string;
	minConfidence?: string;
	apiKeyEnv?: string;
	gate?: boolean;
	json?: boolean;
	dryRun?: boolean;
}
export interface ResponseCheckInput {
	request: string;
	response: string;
	context: string;
	criteria: ResponseCriterion[];
}
export interface ResponseCheckSettings {
	model: string;
	minConfidence: number;
	apiKeyEnv: string;
}
export type ResponseCheckStatus =
	| 'satisfied'
	| 'violations'
	| 'needs-review'
	| 'incomplete'
	| 'dry-run';
export interface ResponseAssessment extends JevChoice {
	id: string;
	title: string;
	status: 'meets' | 'violates' | 'needs-review';
	guidance: string;
}
export interface ResponseCheckReport {
	status: ResponseCheckStatus;
	mode: 'advisory' | 'gate';
	rubricVersion: string;
	requestedModel: string;
	model?: string;
	minConfidence: number;
	inputHashes: Record<string, string>;
	checks: ResponseAssessment[];
	coverage: string[];
	usage: JevUsage;
	error?: string;
}
