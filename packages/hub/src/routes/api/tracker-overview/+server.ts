// @harness-uid u_c7d5pmjxa2
import { env } from '$env/dynamic/private';
import { hubEnvConfig } from '../../../configs/development-tooling/hubEnvConfig';
import { overviewSessions, serveTrackerOverview } from './trackerOverviewPolicy';

/**
 * Only the owner's verified session reads or publishes. The policy owns every check and the body
 * cap. Other methods get the router's default 405.
 */
async function serve(request: Request, platform: App.Platform | undefined): Promise<Response> {
	const config = hubEnvConfig({ ...env, ...platform?.env });
	return serveTrackerOverview(request, {
		ownerId: config.HARNESS_TRACKER_OVERVIEW_OWNER_ACTOR_ID || undefined,
		sessions: overviewSessions(config),
		bucket: config.CACHE,
		now: Date.now()
	});
}

export function GET({
	request,
	platform
}: {
	request: Request;
	platform: App.Platform | undefined;
}): Promise<Response> {
	return serve(request, platform);
}

export function PUT({
	request,
	platform
}: {
	request: Request;
	platform: App.Platform | undefined;
}): Promise<Response> {
	return serve(request, platform);
}
