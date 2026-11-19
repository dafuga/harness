// @harness-uid u_66fcrvj52i
import type {
	TaskUsage,
	TaskApiCost
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { AnalyticsRepository } from '../../repositories/reports-media/AnalyticsRepository';
export type TaskAnalyticsStore = Pick<AnalyticsRepository, 'recordImported' | 'close'>;
export type TaskAnalyticsStoreFactory = () => TaskAnalyticsStore | Promise<TaskAnalyticsStore>;
export interface TaskRunPosition {
	attemptNumber: number;
	priorEscalations: number;
	startedAt?: string;
}
export interface TaskAnalyticsDetail {
	attempt: string;
	feature: string;
	module: string;
	provider: 'claude' | 'codex';
	model: string;
	intelligence: string;
	reportedModel: string | null;
	usage?: TaskUsage;
	apiCost?: TaskApiCost;
	run?: {
		taskType: string;
		estimatedDifficulty: 'small' | 'medium' | 'large' | null;
		attemptNumber: number;
		executionNumber: number;
		priorEscalations: number;
		startedAt: string | null;
		filesTouched: number | null;
		linesChanged: number | null;
		failureCause: string | null;
	};
	rejectionCause?: string;
}
