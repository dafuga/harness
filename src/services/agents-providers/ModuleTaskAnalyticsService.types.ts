// @harness-uid u_66fcrvj52i
import type {
	TaskUsage,
	TaskApiCost,
	TaskExecution,
	ModuleTask
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { AnalyticsRepository } from '../../repositories/reports-media/AnalyticsRepository';
import type { RunRecord } from './module-task-analytics-service/model-analytics.mjs';
export type TaskAnalyticsStore = Pick<AnalyticsRepository, 'recordImported' | 'close'>;
export type TaskAnalyticsStoreFactory = () => TaskAnalyticsStore | Promise<TaskAnalyticsStore>;
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
	modelRun?: RunRecord;
}
export interface TaskRunProgress {
	attempt: number;
	escalations: number;
	previous: string | null;
	rejectedBefore: boolean;
}
export type TaskAnalyticsExecution = Omit<TaskExecution, 'startedAt'> & { startedAt?: string };
export type TaskAnalyticsReview = ModuleTask['reviews'][number];
