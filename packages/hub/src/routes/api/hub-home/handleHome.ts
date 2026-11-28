import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { hubEnvConfig } from '../../../configs/development-tooling/hubEnvConfig';
import { overviewSessions } from '../tracker-overview/trackerOverviewPolicy';
import { outgoingGateway } from '../../(projects-sessions)/api/outgoing-drafts/outgoingGateway';
import { serveHubHome } from './homePolicy';

export const handleHome: RequestHandler = ({ request, platform }) => {
	const privateEnv: Record<string, unknown> = { ...env, ...platform?.env };
	const config = hubEnvConfig(privateEnv);
	return serveHubHome(request, {
		ownerId: config.HARNESS_TRACKER_OVERVIEW_OWNER_ACTOR_ID,
		outgoingDrafts: Boolean(outgoingGateway(privateEnv.HARNESS_TRACKER_OUTGOING_GATEWAY)),
		sessions: overviewSessions(config),
		bucket: config.CACHE,
		db: config.DB,
		accounts: config.ACCOUNT_SYNC ?? null,
		now: Date.now()
	});
};
