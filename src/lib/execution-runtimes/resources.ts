/** Machine-wide admission for Bun and Node 22.13+ hosts; no work starts on import. */
export {
	resourceConfigSchema,
	resourcePriorities,
	resourceRequestSchema
} from '../../core/execution-runtimes/resourceTypes';
export type {
	ResourceConfig,
	ResourceContext,
	ResourceJob,
	ResourceRequest,
	ResourceSnapshot
} from '../../core/execution-runtimes/resourceTypes';
export { ResourceQueueService } from '../../services/execution-runtimes/ResourceQueueService';
export type { RunOptions } from '../../services/execution-runtimes/ResourceQueueService';
export { resourceConfig, saveResourceConfig } from '../../utils/execution-runtimes/resourceConfig';
export { resourceEnvironment } from '../../utils/execution-runtimes/resourceEnvironment';
export { resourceWork } from '../../utils/execution-runtimes/resourceWork';
export { resourceThreads, resourceWorkers } from '../../utils/execution-runtimes/resourceWorkers';
