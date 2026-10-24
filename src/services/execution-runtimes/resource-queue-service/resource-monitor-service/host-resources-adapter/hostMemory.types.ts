import type { ResourceSnapshot } from '../../../../../core/execution-runtimes/resourceTypes';

export type Memory = Pick<
	ResourceSnapshot,
	'memoryTotalBytes' | 'memoryAvailableBytes' | 'memoryPressure'
>;
