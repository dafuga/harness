import type { ModuleTaskToolBrokerAdapterConfig } from './ModuleTaskToolBrokerAdapter.types';

export class ModuleTaskToolBrokerAdapter {
	constructor(private readonly config: ModuleTaskToolBrokerAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'module-task-tool-broker';
	}
}

export type { ModuleTaskToolBrokerAdapterConfig } from './ModuleTaskToolBrokerAdapter.types';
