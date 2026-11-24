// @harness-uid u_32tlacz6al
import { env } from '$env/dynamic/private';
import { hubEnvConfig } from '../../../../configs/development-tooling/hubEnvConfig';
import { overviewSessions } from '../../../api/tracker-overview/trackerOverviewPolicy';
import { serveDeployApprovals } from './serveDeployApprovals';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ request, platform }) => {
	const config = hubEnvConfig({ ...env, ...platform?.env });
	return serveDeployApprovals(request, {
		owner: config.HARNESS_DEPLOY_APPROVER_ID,
		runnerGrants: config.HARNESS_DEPLOY_RUNNER_GRANTS,
		sessions: overviewSessions(config),
		db: config.DB,
		now: Date.now()
	});
};

export const POST = GET;
