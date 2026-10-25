import type {
	TaskUsage,
	TaskApiCost
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { AnalyticsRepository } from '../../repositories/reports-media/AnalyticsRepository';
export type TaskAnalyticsStore = Pick<AnalyticsRepository, 'recordImported' | 'close'>;
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
}
export interface TaskPriceRates {
	threshold: number;
	source: string;
	short: [number, number, number, number, number];
	long: [number, number, number, number, number];
}
