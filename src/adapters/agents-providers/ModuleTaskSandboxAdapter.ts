import type { ModuleTaskSandboxAdapterConfig } from './ModuleTaskSandboxAdapter.types';

export class ModuleTaskSandboxAdapter {
	constructor(private readonly config: ModuleTaskSandboxAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'module-task-sandbox';
	}
}

export type { ModuleTaskSandboxAdapterConfig } from './ModuleTaskSandboxAdapter.types';
