// @harness-uid u_hxkpkiert2
import type {
	TaskApiCost,
	TaskUsage
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';

export type Difficulty = 'small' | 'medium' | 'large';
export type RunOutcome =
	| 'done'
	| 'failed'
	| 'rejected'
	| 'timed_out'
	| 'blocked'
	| 'abandoned'
	| 'pending_review';

export interface RunRecord {
	schemaVersion: 1;
	source: 'tracker' | 'harness';
	id: string;
	taskId: string;
	chainId: string;
	taskType: string;
	project: string | null;
	moduleId: string | null;
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
	linesChanged: number | null;
	rejectionCause: string | null;
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
	apiEquivalentBasis: TaskApiCost['basis'];
	rateCard: string;
	actualUsd: number | null;
	codexCredits: number | null;
}

export type RunRecordInput = Pick<
	RunRecord,
	| 'source'
	| 'id'
	| 'taskId'
	| 'chainId'
	| 'taskType'
	| 'project'
	| 'provider'
	| 'model'
	| 'effort'
	| 'finishedAt'
	| 'outcome'
	| 'attempt'
> &
	Partial<
		Pick<
			RunRecord,
			| 'moduleId'
			| 'startedAt'
			| 'escalations'
			| 'estimatedDifficulty'
			| 'filesTouched'
			| 'linesChanged'
			| 'rejectionCause'
			| 'danielCorrections'
			| 'rejectedBefore'
			| 'actualUsd'
			| 'codexCredits'
		>
	> & {
		usage?: TaskUsage;
		cost?: TaskApiCost;
	};
