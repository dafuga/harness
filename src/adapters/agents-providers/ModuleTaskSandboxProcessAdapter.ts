import type { ModuleTaskSandboxProcessAdapterConfig } from './ModuleTaskSandboxProcessAdapter.types';

export class ModuleTaskSandboxProcessAdapter {
	constructor(private readonly config: ModuleTaskSandboxProcessAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'module-task-sandbox-process';
	}
}

export type { ModuleTaskSandboxProcessAdapterConfig } from './ModuleTaskSandboxProcessAdapter.types';
