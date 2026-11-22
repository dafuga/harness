// @harness-uid u_xsgn6erl3w
import type { ResourceSnapshot } from '../../../../../core/execution-runtimes/resourceTypes';

export type Memory = Pick<
	ResourceSnapshot,
	'memoryTotalBytes' | 'memoryAvailableBytes' | 'memoryPressure'
>;

export { HostMemoryReadError } from './HostMemoryReadError';
