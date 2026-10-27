import type { ModuleTaskCodexBrokerAdapterConfig } from './ModuleTaskCodexBrokerAdapter.types';

export class ModuleTaskCodexBrokerAdapter {
	constructor(private readonly config: ModuleTaskCodexBrokerAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'module-task-codex-broker';
	}
}

export type { ModuleTaskCodexBrokerAdapterConfig } from './ModuleTaskCodexBrokerAdapter.types';
