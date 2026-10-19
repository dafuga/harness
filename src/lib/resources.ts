/** Machine-wide admission for Bun and Node 22.13+ hosts; no work starts on import. */
export { ResourceQueueService } from '../services/ResourceQueueService';
export type { RunOptions } from '../services/ResourceQueueService';
export { resourceWork } from '../utils/resourceWork';
export { resourceWorkers } from '../utils/resourceWorkers';
export { resourceEnvironment } from '../utils/resourceEnvironment';
export { resourceConfig, saveResourceConfig } from '../utils/resourceConfig';
export {
	resourceConfigSchema,
	resourceRequestSchema,
	resourcePriorities
} from '../core/resourceTypes';
export type {
	ResourceConfig,
	ResourceRequest,
	ResourceJob,
	ResourceSnapshot,
	ResourceContext
} from '../core/resourceTypes';
