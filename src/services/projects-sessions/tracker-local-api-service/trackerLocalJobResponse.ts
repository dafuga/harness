// @harness-uid u_g7kdpz7bel
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerLocalApiOptions } from '../TrackerLocalApiService.types';
import { trackerJobEndpoint } from './trackerLocalJobs';
import { trackerResponse } from './trackerLocalResponse';

export async function trackerJobResponse(
	request: Request,
	parts: string[],
	{ items, options }: { items: TrackerItemReadRepository; options: TrackerLocalApiOptions }
): Promise<Response> {
	const result = await trackerJobEndpoint(request, parts, { items, jobs: options.jobs });
	return result === undefined
		? trackerResponse(404, { error: `no route ${request.method} /${parts.join('/')}` })
		: trackerResponse(200, result);
}
