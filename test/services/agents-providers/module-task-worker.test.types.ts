/** Types for the owning worker method matrix. */
import type { ModuleTask } from '../../../src/repositories/agents-providers/ModuleTaskRepository.types';

export type {
	ModuleTask,
	TaskRunInput,
	TaskRunScope
} from '../../../src/repositories/agents-providers/ModuleTaskRepository.types';

export type WorkerContextCall = {
	task: ModuleTask;
	worktree: string;
	files: string[];
};
