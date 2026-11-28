// @harness-uid u_hlwlmsclx6
import type {
	ResourceContext,
	ResourceRequest
} from '../../../core/execution-runtimes/resourceTypes';
import { resourceContext } from '../../../utils/execution-runtimes/resourceContext';
import { ProcessIdentityAdapter } from '../../agents-providers/agent-activity-service/ProcessIdentityAdapter';
import { ResourceQueueError } from '../ResourceQueueError';
import type { ResourceQueueRepository } from './ResourceQueueRepository';

/**
 * A provider sandbox forbids asking the system about processes, so nested work there can prove
 * neither its own identity nor its cleanup. It runs under its parent's running lease: the lease
 * holder outside the sandbox already reserves the resources and tears the process group down.
 */
export function inheritedLeaseContext(
	request: ResourceRequest,
	env: Record<string, string | undefined>,
	queue: ResourceQueueRepository
): ResourceContext | undefined {
	const lease = env.HARNESS_RESOURCE_LEASE;
	if (!lease || new ProcessIdentityAdapter().find(process.pid).exists !== undefined)
		return undefined;
	const parent = queue.all().find((job) => job.id === lease && job.state === 'running');
	if (!parent) throw new ResourceQueueError('Invalid inherited resource lease');
	if (request.cpus > parent.cpus || request.memoryMiB > parent.memoryMiB)
		throw new ResourceQueueError('Nested work exceeds its parent resource reservation');
	return { ...resourceContext(lease, request, env, queue), track: () => {}, inherited: true };
}
