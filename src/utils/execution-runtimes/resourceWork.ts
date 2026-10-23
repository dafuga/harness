import {
	resourceRequestSchema,
	type ResourceContext,
	type ResourceRequest
} from '../../core/execution-runtimes/resourceTypes';
import {
	ResourceQueueService,
	type RunOptions
} from '../../services/execution-runtimes/ResourceQueueService';
import { resourceEnvironment } from './resourceEnvironment';
/** Read-only metadata and monitoring tools do not consume a work slot. */
export async function resourceWork<T>(
	request: Partial<ResourceRequest>,
	action: (context: ResourceContext) => Promise<T>,
	env: Record<string, string | undefined> = process.env,
	options: Omit<RunOptions, 'env'> = {}
): Promise<T> {
	const controlled = { ...resourceEnvironment(), ...env };
	const service = new ResourceQueueService({
		home: controlled.HARNESS_RESOURCES_HOME,
		env: controlled
	});
	try {
		return await service.run(
			resourceRequestSchema.parse({
				...request,
				cpus:
					request.cpus ??
					(controlled.HARNESS_RESOURCE_LEASE
						? Math.min(1, Number(controlled.HARNESS_RESOURCE_CPUS))
						: 1)
			}),
			action,
			{
				...options,
				env: controlled
			}
		);
	} finally {
		service.close();
	}
}
