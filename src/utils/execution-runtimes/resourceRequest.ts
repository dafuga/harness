import {
	mib,
	resourceRequestSchema,
	type ResourceRequest
} from '../../core/execution-runtimes/resourceTypes';
import { memoryReserve } from '../../services/execution-runtimes/resource-queue-service/resource-policy/resourcePolicy';
import type { ResourceQueueService } from '../../services/execution-runtimes/ResourceQueueService';
import { resourceConfig } from './resourceConfig';
/** Auto sizing uses current headroom, existing reservations and a per-worker RAM estimate. */
export async function resourceRequest(
	flags: Record<string, string>,
	service: Pick<ResourceQueueService, 'home' | 'snapshot'> & {
		queue: Pick<ResourceQueueService['queue'], 'all'>;
	},
	env: Record<string, string | undefined> = process.env
): Promise<ResourceRequest> {
	const parent = env.HARNESS_RESOURCE_LEASE;
	const sample = await service.snapshot(),
		config = resourceConfig(service.home);
	const running = service.queue.all().filter((j) => j.state === 'running' && !j.parentId);
	const cpu =
		sample.cpuAvailableCores -
		(sample.usableCores * config.cpuReservePercent) / 100 -
		running.reduce((n, j) => n + j.cpus, 0);
	const memory =
		(sample.memoryAvailableBytes - memoryReserve(sample, config)) / mib -
		running.reduce((n, j) => n + j.memoryMiB, 0);
	const maximum =
		sample.status === 'available' && sample.usableCores > 0
			? sample.usableCores * (1 - config.cpuReservePercent / 100)
			: 1;
	const automatic = Math.min(
		maximum,
		Math.max(1, Math.min(Math.floor(cpu), Math.floor((memory - 256) / 512)))
	);
	let cpus = Number(flags.cpus),
		memoryMiB = Number(flags.memoryMib);
	if (flags.cpus === 'auto') cpus = parent ? Number(env.HARNESS_RESOURCE_CPUS) : automatic;
	if (flags.memoryMib === 'auto')
		memoryMiB = parent ? Number(env.HARNESS_RESOURCE_MEMORY_MIB) : cpus * 512 + 256;
	return resourceRequestSchema.parse({
		priority: flags.priority,
		cpus,
		memoryMiB,
		label: flags.label
	});
}
