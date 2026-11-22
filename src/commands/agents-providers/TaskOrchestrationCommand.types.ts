// @harness-uid u_wgjqmurp64
import type { z } from 'zod';
import type { TaskPlatform } from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { taskInputSchema } from '../../repositories/agents-providers/module-task-repository/taskSchemas';

export interface OrchestratorFlags {
	tracker: string;
	brief: string;
	model: string;
	intelligence: NonNullable<z.infer<typeof taskInputSchema>['intelligence']>;
	contextTokens: number;
	platform?: TaskPlatform;
}
