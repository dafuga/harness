import type { ModuleTaskCodexProfileAdapterConfig } from './ModuleTaskCodexProfileAdapter.types';

export class ModuleTaskCodexProfileAdapter {
	constructor(private readonly config: ModuleTaskCodexProfileAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'module-task-codex-profile';
	}
}

export type { ModuleTaskCodexProfileAdapterConfig } from './ModuleTaskCodexProfileAdapter.types';
