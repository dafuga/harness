import type { z } from 'zod';
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
}
export interface TaskRunner {
	run(input: TaskRunInput): Promise<TaskRunResult>;
}
