import type { ModuleTaskBrokerTransportAdapterConfig } from './ModuleTaskBrokerTransportAdapter.types';

export class ModuleTaskBrokerTransportAdapter {
	constructor(private readonly config: ModuleTaskBrokerTransportAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'module-task-broker-transport';
	}
}

export type { ModuleTaskBrokerTransportAdapterConfig } from './ModuleTaskBrokerTransportAdapter.types';
