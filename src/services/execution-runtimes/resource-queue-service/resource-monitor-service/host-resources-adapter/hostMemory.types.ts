// @harness-uid u_xsgn6erl3w
import type { ResourceSnapshot } from '../../../../../core/execution-runtimes/resourceTypes';

export type Memory = Pick<
	ResourceSnapshot,
	'memoryTotalBytes' | 'memoryAvailableBytes' | 'memoryPressure'
>;
/** Host memory could not be read: its counters were invalid or its platform is unsupported. */
export class HostMemoryReadError extends Error {
	override name = 'HostMemoryReadError';
}
