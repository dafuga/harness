// @harness-uid u_n6dmwj3gpk
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { hubEnvConfig } from '../../../../configs/development-tooling/hubEnvConfig';
import { overviewSessions } from '../../../api/tracker-overview/trackerOverviewPolicy';
import { serveOutgoingDrafts } from './serveOutgoingDrafts';
import { outgoingGateway } from './outgoingGateway';

const handler: RequestHandler = ({ request, platform }) => {
	const privateEnv: Record<string, unknown> = { ...env, ...platform?.env };
	const config = hubEnvConfig(privateEnv);
	return serveOutgoingDrafts(request, {
		ownerId: config.HARNESS_TRACKER_OVERVIEW_OWNER_ACTOR_ID,
		sessions: overviewSessions(config),
		gateway: outgoingGateway(privateEnv.HARNESS_TRACKER_OUTGOING_GATEWAY),
		fetcher: fetch,
		now: Date.now()
	});
};
export const GET = handler;
export const POST = handler;
