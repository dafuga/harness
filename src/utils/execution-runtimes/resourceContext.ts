import type { ResourceContext, ResourceRequest } from '../../core/execution-runtimes/resourceTypes';
import { ProcessIdentityAdapter } from '../../services/agents-providers/agent-activity-service/ProcessIdentityAdapter';
import type { ResourceQueueRepository } from '../../services/execution-runtimes/resource-queue-service/ResourceQueueRepository';
import { resourceThreads } from './resourceWorkers';
/** Pass only this lease and its bounded budget to child work. */
export function resourceContext(
	id: string,
	request: ResourceRequest,
	env: Record<string, string | undefined>,
	queue: ResourceQueueRepository
): ResourceContext {
	const managed = {
		...env,
		HARNESS_RESOURCE_LEASE: id,
		HARNESS_RESOURCE_CPUS: String(request.cpus),
		HARNESS_RESOURCE_MEMORY_MIB: String(request.memoryMiB),
		HARNESS_RESOURCE_PRIORITY: request.priority
	};
	return {
		id,
		env: { ...managed, ...resourceThreads(managed) },
		track: (pid) => {
			const identity = new ProcessIdentityAdapter().find(pid);
			if (identity.exists === false) return;
			queue.patch(id, { workerPid: pid, workerStarted: identity.startedAt ?? undefined });
		}
	};
}
