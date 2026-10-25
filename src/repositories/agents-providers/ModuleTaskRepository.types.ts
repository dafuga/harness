import type { z } from 'zod';
import type {
	taskUsageSchema,
	taskExecutionSchema,
	taskCostSchema
} from './module-task-repository/taskUsage';
export type TaskUsage = z.infer<typeof taskUsageSchema>;
export type TaskExecution = z.infer<typeof taskExecutionSchema>;
export type TaskApiCost = z.infer<typeof taskCostSchema>;
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
}
export interface TaskRunResult extends TaskSelection {
	text: string;
	reportedModel: string | null;
	usage?: TaskUsage;
}
export interface TaskRunner {
	run(input: TaskRunInput): Promise<TaskRunResult>;
}
