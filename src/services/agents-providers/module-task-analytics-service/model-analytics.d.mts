// @harness-uid u_sak3l4rbdc
/** @typedef {{inputTokens: number|null, outputTokens: number|null, cacheReadTokens: number|null, cacheWriteTokens: number|null, cacheWriteLongTokens?: number|null, reportedCostUsd?: number|null}} TokenUsage */
/** @typedef {{usd: number|null, minimumUsd: number|null, maximumUsd: number|null,
 * basis: 'cli-reported'|'standard-api-estimate'|'unavailable', rateCard: string, source: string|null, note: string}} ApiEquivalentCost */
/**
 * The model run's total input includes cache reads and writes. Aggregated usage
 * may span different prompt lengths, so compute bounds where tiers are unknown.
 * @param {string} model @param {TokenUsage} [usage]
 * @returns {ApiEquivalentCost}
 */
export function estimateApiCost(model: string, usage?: TokenUsage): ApiEquivalentCost;
/** @param {string} [title] @param {string} [notes] @param {string} [fallback] */
export function classifyTaskType(title?: string, notes?: string, fallback?: string): string;
/** @typedef {'tracker'|'harness'} RunSource */
/** @typedef {'done'|'failed'|'rejected'|'timed_out'|'blocked'|'abandoned'|'pending_review'} RunOutcome */
/** @typedef {'small'|'medium'|'large'} Difficulty */
/** @typedef {{
 *   source: RunSource, id: string, taskId: string, chainId: string, taskType: string,
 *   project: string|null, provider: string, model: string, effort: string|null,
 *   startedAt?: string|null, finishedAt: string, outcome: RunOutcome, attempt: number|null,
 *   escalations?: number|null, estimatedDifficulty?: Difficulty|null, filesTouched?: number|null,
 *   danielCorrections?: number|null, rejectedBefore?: boolean|null, usage?: TokenUsage, cost?: ApiEquivalentCost,
 *   actualUsd?: number|null, codexCredits?: number|null
 * }} RunRecordInput */
/** @param {number|null} files @returns {Difficulty|null} */
export function difficultyForFiles(files: number | null): Difficulty | null;
/** @param {RunRecordInput} input */
export function createRunRecord(input: RunRecordInput): {
	schemaVersion: number;
	source: RunSource;
	id: string;
	taskId: string;
	chainId: string;
	taskType: string;
	project: string | null;
	provider: string;
	model: string;
	effort: string | null;
	startedAt: string | null;
	finishedAt: string;
	wallTimeMs: number | null;
	outcome: RunOutcome;
	attempt: number | null;
	retries: number | null;
	escalations: number | null;
	firstTry: boolean;
	estimatedDifficulty: Difficulty | null;
	measuredDifficulty: Difficulty | null;
	filesTouched: number | null;
	danielCorrections: number | null;
	rejectedBefore: boolean | null;
	reworked: boolean;
	inputTokens: number | null;
	outputTokens: number | null;
	cacheReadTokens: number | null;
	cacheWriteTokens: number | null;
	apiEquivalentUsd: number | null;
	apiEquivalentMinUsd: number | null;
	apiEquivalentMaxUsd: number | null;
	apiEquivalentBasis: 'cli-reported' | 'standard-api-estimate' | 'unavailable';
	rateCard: string;
	actualUsd: number | null;
	codexCredits: number | null;
};
/** @typedef {ReturnType<typeof createRunRecord>} RunRecord */
/** @param {RunRecord[]} records */
export function summarizeModelRuns(records: RunRecord[]): {
	rows: {
		taskType: string;
		model: string | null;
		effort: string | null;
		week: string | null;
		runs: number;
		successes: number;
		successfulTasks: number;
		failures: number;
		successRate: number | null;
		firstTry: number;
		retryRuns: number;
		escalationRuns: number;
		rejected: number;
		reworked: number;
		danielCorrections: number;
		averageInputTokens: number | null;
		averageOutputTokens: number | null;
		averageWallTimeMs: number | null;
		pricedRuns: number;
		costPerSuccessfulTaskMinUsd: number | null;
		costPerSuccessfulTaskMaxUsd: number | null;
		actualUsd: {
			total: number | null;
			knownRuns: number;
		};
		codexCredits: {
			total: number | null;
			knownRuns: number;
		};
	}[];
	trend: {
		taskType: string;
		model: string | null;
		effort: string | null;
		week: string | null;
		runs: number;
		successes: number;
		successfulTasks: number;
		failures: number;
		successRate: number | null;
		firstTry: number;
		retryRuns: number;
		escalationRuns: number;
		rejected: number;
		reworked: number;
		danielCorrections: number;
		averageInputTokens: number | null;
		averageOutputTokens: number | null;
		averageWallTimeMs: number | null;
		pricedRuns: number;
		costPerSuccessfulTaskMinUsd: number | null;
		costPerSuccessfulTaskMaxUsd: number | null;
		actualUsd: {
			total: number | null;
			knownRuns: number;
		};
		codexCredits: {
			total: number | null;
			knownRuns: number;
		};
	}[];
	byTaskType: {
		taskType: string;
		model: string | null;
		effort: string | null;
		week: string | null;
		runs: number;
		successes: number;
		successfulTasks: number;
		failures: number;
		successRate: number | null;
		firstTry: number;
		retryRuns: number;
		escalationRuns: number;
		rejected: number;
		reworked: number;
		danielCorrections: number;
		averageInputTokens: number | null;
		averageOutputTokens: number | null;
		averageWallTimeMs: number | null;
		pricedRuns: number;
		costPerSuccessfulTaskMinUsd: number | null;
		costPerSuccessfulTaskMaxUsd: number | null;
		actualUsd: {
			total: number | null;
			knownRuns: number;
		};
		codexCredits: {
			total: number | null;
			knownRuns: number;
		};
	}[];
	recommendations: {
		taskType: string;
		model: string | null;
		effort: string | null;
		week: string | null;
		runs: number;
		successes: number;
		successfulTasks: number;
		failures: number;
		successRate: number | null;
		firstTry: number;
		retryRuns: number;
		escalationRuns: number;
		rejected: number;
		reworked: number;
		danielCorrections: number;
		averageInputTokens: number | null;
		averageOutputTokens: number | null;
		averageWallTimeMs: number | null;
		pricedRuns: number;
		costPerSuccessfulTaskMinUsd: number | null;
		costPerSuccessfulTaskMaxUsd: number | null;
		actualUsd: {
			total: number | null;
			knownRuns: number;
		};
		codexCredits: {
			total: number | null;
			knownRuns: number;
		};
	}[];
};
/**
 * Rank independently observed first attempts. Retried successes do not count
 * as first-try success for either model. The conservative upper cost is used.
 * @param {RunRecord[]} records @param {{minSamples?: number, reliability?: number, allCandidates?: boolean}} [options]
 */
export function recommendModels(
	records: RunRecord[],
	{
		minSamples,
		reliability,
		allCandidates
	}?: {
		minSamples?: number;
		reliability?: number;
		allCandidates?: boolean;
	}
): {
	taskType: string;
	model: string | null;
	effort: string | null;
	week: string | null;
	runs: number;
	successes: number;
	successfulTasks: number;
	failures: number;
	successRate: number | null;
	firstTry: number;
	retryRuns: number;
	escalationRuns: number;
	rejected: number;
	reworked: number;
	danielCorrections: number;
	averageInputTokens: number | null;
	averageOutputTokens: number | null;
	averageWallTimeMs: number | null;
	pricedRuns: number;
	costPerSuccessfulTaskMinUsd: number | null;
	costPerSuccessfulTaskMaxUsd: number | null;
	actualUsd: {
		total: number | null;
		knownRuns: number;
	};
	codexCredits: {
		total: number | null;
		knownRuns: number;
	};
}[];
export const RUN_SCHEMA_VERSION: 1;
export const RATE_CARD: 'standard-global-2026-11-19';
export type TokenUsage = {
	inputTokens: number | null;
	outputTokens: number | null;
	cacheReadTokens: number | null;
	cacheWriteTokens: number | null;
	cacheWriteLongTokens?: number | null;
	reportedCostUsd?: number | null;
};
export type ApiEquivalentCost = {
	usd: number | null;
	minimumUsd: number | null;
	maximumUsd: number | null;
	basis: 'cli-reported' | 'standard-api-estimate' | 'unavailable';
	rateCard: string;
	source: string | null;
	note: string;
};
export type RunSource = 'tracker' | 'harness';
export type RunOutcome =
	| 'done'
	| 'failed'
	| 'rejected'
	| 'timed_out'
	| 'blocked'
	| 'abandoned'
	| 'pending_review';
export type Difficulty = 'small' | 'medium' | 'large';
export type RunRecordInput = {
	source: RunSource;
	id: string;
	taskId: string;
	chainId: string;
	taskType: string;
	project: string | null;
	provider: string;
	model: string;
	effort: string | null;
	startedAt?: string | null;
	finishedAt: string;
	outcome: RunOutcome;
	attempt: number | null;
	escalations?: number | null;
	estimatedDifficulty?: Difficulty | null;
	filesTouched?: number | null;
	danielCorrections?: number | null;
	rejectedBefore?: boolean | null;
	usage?: TokenUsage;
	cost?: ApiEquivalentCost;
	actualUsd?: number | null;
	codexCredits?: number | null;
};
export type RunRecord = ReturnType<typeof createRunRecord>;
