import { env } from '$env/dynamic/private';
import { hubEnvConfig } from '../../../configs/development-tooling/hubEnvConfig';
import { overviewSessions } from '../tracker-overview/trackerOverviewPolicy';
import { servePush } from './pushPolicy';

export function handlePush({
	request,
	platform
}: {
	request: Request;
	platform: App.Platform | undefined;
}): Promise<Response> {
	const config = hubEnvConfig({ ...env, ...platform?.env });
	return servePush(request, {
		ownerId: config.HARNESS_TRACKER_OVERVIEW_OWNER_ACTOR_ID,
		publicKey: config.HARNESS_PUSH_PUBLIC_KEY,
		origin: config.HARNESS_PUBLIC_ORIGIN,
		sessions: overviewSessions(config),
		db: config.DB,
		now: Date.now()
	});
}
