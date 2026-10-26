import type { ModuleTaskLaunchAdapterConfig } from './ModuleTaskLaunchAdapter.types';

export class ModuleTaskLaunchAdapter {
	constructor(private readonly config: ModuleTaskLaunchAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'module-task-launch';
	}
}

export type { ModuleTaskLaunchAdapterConfig } from './ModuleTaskLaunchAdapter.types';
