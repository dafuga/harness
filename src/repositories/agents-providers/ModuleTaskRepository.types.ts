// @harness-uid u_bya7wvvkm5
import type { z } from 'zod';
import type {
	taskUsageSchema,
	taskExecutionSchema,
	taskSessionMetricSchema,
	taskCostSchema
} from './module-task-repository/taskUsage';
export type TaskUsage = z.infer<typeof taskUsageSchema>;
export type TaskExecution = z.infer<typeof taskExecutionSchema>;
export type TaskApiCost = z.infer<typeof taskCostSchema>;
export type TaskSessionMetric = z.infer<typeof taskSessionMetricSchema>;
import type {
	featureSchema,
	taskInputSchema,
	queueSchema
} from './module-task-repository/taskSchemas';
export type TaskFeature = z.infer<typeof featureSchema>;
export type ModuleTaskInput = z.infer<typeof taskInputSchema>;
export type ModuleTaskQueue = z.infer<typeof queueSchema>;
export type ModuleTask = ModuleTaskQueue['tasks'][number];
export type TaskSelection = { provider: 'claude' | 'codex'; model: string; intelligence: string };
export interface TaskRunInput extends TaskSelection {
	cwd: string;
	prompt: string;
	signal: AbortSignal;
	supervision?: TaskSupervision;
	onRotation?: (checkpoint: string, session: TaskSessionMetric) => Promise<void>;
}
export interface TaskSupervision {
	checkpoint: string;
	contextTokens: number;
	tracker: string;
	onSession: (session: TaskSessionMetric) => Promise<void>;
}
export interface TaskRunResult extends TaskSelection {
	text: string;
	reportedModel: string | null;
	usage?: TaskUsage;
	sessions?: TaskSessionMetric[];
}
export interface TaskRunner {
	run(input: TaskRunInput): Promise<TaskRunResult>;
}
