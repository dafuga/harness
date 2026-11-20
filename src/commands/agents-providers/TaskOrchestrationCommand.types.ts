// @harness-uid u_wgjqmurp64
import type { z } from 'zod';
import type { taskInputSchema } from '../../repositories/agents-providers/module-task-repository/taskSchemas';

export interface OrchestratorFlags {
	tracker: string;
	brief: string;
	model: string;
	intelligence: NonNullable<z.infer<typeof taskInputSchema>['intelligence']>;
	contextTokens: number;
}

export class TaskOrchestrationError extends Error {
	override name = 'TaskOrchestrationError';
}
