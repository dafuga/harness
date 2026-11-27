// @harness-uid u_khp57qb4g7
import type {
	AnalyticsEvent,
	AnalyticsFilter,
	LoopMetric
} from '../../core/reports-media/analyticsTypes';
import type { ModuleTaskAnalyticsService } from '../../services/agents-providers/ModuleTaskAnalyticsService';
import type { taskRunReport } from '../../services/agents-providers/module-task-analytics-service/taskRunReport';
import type { jevMetrics } from './analyticsJevMetrics';

type JevMetrics = ReturnType<typeof jevMetrics>;
type TaskMetrics = ReturnType<ModuleTaskAnalyticsService['metrics']>;

export interface AnalyticsSummary {
	events: number;
	projects: number;
	commands: Record<string, number>;
	loops: number;
	completedLoops: number;
	evaluatorOutcomes: Record<string, number>;
	templates: Record<string, number>;
	daily: Record<string, number>;
}

export interface AnalyticsModelMetrics {
	authors: Record<string, number>;
	loopAuthors: Record<string, number>;
	evaluators: Record<string, number>;
	inputTokens: number;
	outputTokens: number;
	firstTryByAuthor: Record<string, { response: JevMetrics; cleanCode: JevMetrics }>;
}

export interface AnalyticsSnapshot {
	schemaVersion: number;
	generatedAt: string;
	filters: AnalyticsFilter;
	summary: AnalyticsSummary;
	loops: LoopMetric[];
	jev: { response: JevMetrics; cleanCode: JevMetrics };
	models: AnalyticsModelMetrics & { taskWorkers: TaskMetrics['byModel'] };
	/** The run reports are present only when the caller asked for task runs. */
	tasks: TaskMetrics & Partial<ReturnType<typeof taskRunReport>>;
	benchmarks: AnalyticsEvent[];
	events: AnalyticsEvent[];
}
