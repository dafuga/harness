import type { TaskRunInput } from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { TaskProcessInput, TaskProcessResult } from './ModuleTaskRunnerAdapter.types';
import type { ModuleTaskSandboxAdapter } from './ModuleTaskSandboxAdapter';

export interface ModuleTaskLaunchAdapterConfig {
	name?: string;
}

export type ModuleTaskLaunchProvider = 'claude' | 'codex';

export type ModuleTaskLaunchExecute = (
	argv: string[],
	input: TaskProcessInput
) => Promise<TaskProcessResult>;

export type ModuleTaskLaunchSandbox = Pick<ModuleTaskSandboxAdapter, 'prepare'>;

export type ModuleTaskLaunchInput = TaskRunInput;
