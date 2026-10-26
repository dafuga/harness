import type { ModuleTaskDependencyBaseAdapter } from '../../adapters/agents-providers/ModuleTaskDependencyBaseAdapter';
import type {
	ModuleTask,
	TaskRunner
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { ModuleTaskContractContextService } from '../../services/agents-providers/ModuleTaskContractContextService';
import type { ModuleTaskService } from '../../services/agents-providers/ModuleTaskService';
import type { taskWorkspace } from '../../services/agents-providers/module-task-worker-service/taskWorkspace';

export type ExecutionResult = Awaited<ReturnType<typeof taskWorkspace>>;

export interface ClaimedTaskExecution {
	root: string;
	task: ModuleTask;
	commit: string;
	checkpoints: string[];
	signal: AbortSignal;
	preflight: ReturnType<ModuleTaskService['prepare']>;
	runner: TaskRunner;
	contexts: Pick<ModuleTaskContractContextService, 'create'>;
	dependencyBase: Pick<ModuleTaskDependencyBaseAdapter, 'resolve'>;
}
