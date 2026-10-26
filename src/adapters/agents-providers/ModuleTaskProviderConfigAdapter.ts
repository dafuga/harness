import type { ModuleTaskProviderConfigAdapterConfig } from './ModuleTaskProviderConfigAdapter.types';

export class ModuleTaskProviderConfigAdapter {
	constructor(private readonly config: ModuleTaskProviderConfigAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'module-task-provider-config';
	}
}

export type { ModuleTaskProviderConfigAdapterConfig } from './ModuleTaskProviderConfigAdapter.types';
