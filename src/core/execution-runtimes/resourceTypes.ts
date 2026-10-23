import { z } from 'zod';
export type {
	ResourceConfig,
	ResourceContext,
	ResourceJob,
	ResourceRequest,
	ResourceSnapshot
} from './resourceTypes.types';
export const resourcePriorities = ['agent-test', 'coding', 'environment'] as const;
export const resourcePriority = z.enum(resourcePriorities);
export const resourceConfigSchema = z.strictObject({
	schemaVersion: z.literal(1).default(1),
	cpuReservePercent: z.number().min(10).max(95).default(10),
	memoryReservePercent: z.number().min(10).max(90).default(10),
	minMemoryReserveMiB: z.number().int().min(2048).default(2048),
	pollMs: z.number().int().min(250).max(10000).default(1000),
	staleSampleMs: z.number().int().min(1000).max(30000).default(5000)
});
export const resourceRequestSchema = z.strictObject({
	priority: resourcePriority.default('coding'),
	cpus: z.number().finite().positive().default(1),
	memoryMiB: z.number().finite().positive().default(512),
	label: z.string().min(1).max(100).default('Managed work')
});
export const resourceJobSchema = resourceRequestSchema.extend({
	id: z.string().uuid(),
	parentId: z.string().uuid().optional(),
	sequence: z.number().int().positive(),
	ownerPid: z.number().int().positive(),
	ownerStarted: z.string().min(1),
	workerPid: z.number().int().positive().optional(),
	workerStarted: z.string().min(1).optional(),
	state: z.enum(['queued', 'running']),
	createdAt: z.number().finite(),
	heartbeatAt: z.number().finite(),
	notice: z.string().nullable()
});
export const mib = 1024 * 1024;
