// @harness-uid u_kgyfgod62o
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { hubEnvConfig } from '../../../../configs/development-tooling/hubEnvConfig';
import { overviewSessions } from '../trackerOverviewPolicy';
import { serveFeatureDeliveries } from './deliveryPolicy';

export const GET: RequestHandler = ({ request, platform }) => {
	const config = hubEnvConfig({ ...env, ...platform?.env });
	return serveFeatureDeliveries(request, {
		ownerId: config.HARNESS_TRACKER_OVERVIEW_OWNER_ACTOR_ID,
		sessions: overviewSessions(config),
		bucket: config.EVIDENCE
	});
};
export const HEAD = GET;
