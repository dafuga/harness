// @harness-uid u_rw64iex44n
import type {
	TaskRunInput,
	TaskSelection
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';

export type CodexTaskSelection = TaskSelection &
	Partial<Pick<TaskRunInput, 'images' | 'cwd' | 'platform' | 'session'>>;
