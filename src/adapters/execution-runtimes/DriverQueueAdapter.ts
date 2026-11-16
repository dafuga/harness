// @harness-uid u_ew2a54dglc
import type { DriverQueueAdapterConfig } from './DriverQueueAdapter.types';

export class DriverQueueAdapter {
	constructor(private readonly config: DriverQueueAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'driver-queue';
	}
}

export type { DriverQueueAdapterConfig } from './DriverQueueAdapter.types';
