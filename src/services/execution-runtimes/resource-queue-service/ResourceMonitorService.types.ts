import type { ResourceSnapshot } from '../../../core/execution-runtimes/resourceTypes';
import type { ResourceQueueRepository } from './ResourceQueueRepository';

export interface MonitorOptions {
	home: string;
	queue: ResourceQueueRepository;
	adapter?: { sample(): Promise<ResourceSnapshot> };
}
