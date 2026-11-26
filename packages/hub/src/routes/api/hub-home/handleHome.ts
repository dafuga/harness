import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { hubEnvConfig } from '../../../configs/development-tooling/hubEnvConfig';
import { overviewSessions } from '../tracker-overview/trackerOverviewPolicy';
import { serveHubHome } from './homePolicy';

export const handleHome: RequestHandler = ({ request, platform }) => {
	const config = hubEnvConfig({ ...env, ...platform?.env });
	return serveHubHome(request, {
		ownerId: config.HARNESS_TRACKER_OVERVIEW_OWNER_ACTOR_ID,
		sessions: overviewSessions(config),
		bucket: config.CACHE,
		db: config.DB,
		accounts: config.ACCOUNT_SYNC ?? null,
		now: Date.now()
	});
};
