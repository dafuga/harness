// @harness-uid u_fmcqhqvyi2
import { env } from '$env/dynamic/private';
import { sendWebPush } from '../../../../../../../../src/services/projects-sessions/tracker-web-push-service/webPushTransport';
import type { RequestHandler } from './$types';
import { hubEnvConfig } from '../../../../../configs/development-tooling/hubEnvConfig';
import { overviewSessions } from '../../../tracker-overview/trackerOverviewPolicy';
import { serveSync } from '../../syncPolicy';

const handle: RequestHandler = ({ request, platform }) => {
	const config = hubEnvConfig({ ...env, ...platform?.env });
	const now = Date.now();
	const {
		HARNESS_PUSH_PUBLIC_KEY: publicKey,
		HARNESS_PUSH_PRIVATE_KEY: privateKey,
		HARNESS_PUBLIC_ORIGIN: hubOrigin
	} = config;
	const ctx = platform?.ctx;
	return serveSync(request, {
		sessions: overviewSessions(config),
		db: config.DB,
		bucket: config.CACHE,
		accounts: config.ACCOUNT_SYNC ?? null,
		now,
		approvalPush:
			publicKey && privateKey && hubOrigin
				? {
						publicKey,
						deliver: (target) =>
							sendWebPush(
								{ version: 1, publicKey, privateKey, hubOrigin },
								{ fetch: (url, init) => fetch(url, init), now },
								{ target, message: { kind: 'device-approval' } }
							),
						schedule: ctx ? (work) => ctx.waitUntil(work) : undefined
					}
				: undefined
	});
};

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
