import type { TaskRunScope } from '../../repositories/agents-providers/ModuleTaskRepository.types';

export interface ModuleTaskContractContext {
	scope: TaskRunScope;
	binDirectory: string;
	cleanup(): Promise<void>;
}
