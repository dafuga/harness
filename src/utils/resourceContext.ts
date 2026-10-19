import { ProcessIdentityAdapter } from '../adapters/ProcessIdentityAdapter';
import type { ResourceQueueRepository } from '../repositories/ResourceQueueRepository';
import type { ResourceContext, ResourceRequest } from '../core/resourceTypes';
/** Pass only this lease and its bounded budget to child work. */
export function resourceContext(
	id: string,
	request: ResourceRequest,
	env: Record<string, string | undefined>,
	queue: ResourceQueueRepository
): ResourceContext {
	return {
		id,
		env: {
			...env,
			HARNESS_RESOURCE_LEASE: id,
			HARNESS_RESOURCE_CPUS: String(request.cpus),
			HARNESS_RESOURCE_MEMORY_MIB: String(request.memoryMiB),
			HARNESS_RESOURCE_PRIORITY: request.priority
		},
		track: (pid) => {
			const identity = new ProcessIdentityAdapter().find(pid);
			if (identity.exists === false) return;
			queue.patch(id, { workerPid: pid, workerStarted: identity.startedAt ?? undefined });
		}
	};
}
