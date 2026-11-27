// @harness-uid u_fmcqhqvyi2
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { hubEnvConfig } from '../../../../../configs/development-tooling/hubEnvConfig';
import { overviewSessions } from '../../../tracker-overview/trackerOverviewPolicy';
import { serveSync } from '../../syncPolicy';

const handle: RequestHandler = ({ request, platform }) => {
	const config = hubEnvConfig({ ...env, ...platform?.env });
	return serveSync(request, {
		sessions: overviewSessions(config),
		db: config.DB,
		bucket: config.CACHE,
		accounts: config.ACCOUNT_SYNC ?? null,
		now: Date.now()
	});
};

export const GET = handle;
export const POST = handle;
export const PUT = handle;
