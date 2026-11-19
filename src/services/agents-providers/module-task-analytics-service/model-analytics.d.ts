// @harness-uid u_sak3l4rbdc
// Types for the byte-identical Tracker module.
export const estimateApiCost: (model: string, usage?: TokenUsage) => ApiEquivalentCost;

export const classifyTaskType: (title?: string, notes?: string, fallback?: string) => string;

export const difficultyForFiles: (files: number | null) => Difficulty | null;

export const createRunRecord: (input: RunRecordInput) => {
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

export const summarizeModelRuns: (records: RunRecord[]) => ModelRunSummary;

export const recommendModels: (
	records: RunRecord[],
	options?: {
		minSamples?: number;
		reliability?: number;
		allCandidates?: boolean;
	}
) => ModelRunSummaryRow[];

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

export type ModelRunSummaryRow = {
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
};

export type ModelRunSummary = {
	rows: ModelRunSummaryRow[];
	trend: ModelRunSummaryRow[];
	byTaskType: ModelRunSummaryRow[];
	recommendations: ModelRunSummaryRow[];
};
