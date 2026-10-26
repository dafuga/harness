import type { ModuleTaskDependencyBaseAdapterConfig } from './ModuleTaskDependencyBaseAdapter.types';

export class ModuleTaskDependencyBaseAdapter {
	constructor(private readonly config: ModuleTaskDependencyBaseAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'module-task-dependency-base';
	}
}

export type { ModuleTaskDependencyBaseAdapterConfig } from './ModuleTaskDependencyBaseAdapter.types';
