// @harness-uid u_fmcqhqvyi2
import { env } from '$env/dynamic/private';
import { sendWebPush } from '../../../../../../../../src/services/projects-sessions/tracker-web-push-service/webPushTransport';
import type { RequestHandler } from './$types';
import type { HubEnv } from '../../../../../configs/development-tooling/hubEnvConfig.types';
import { hubEnvConfig } from '../../../../../configs/development-tooling/hubEnvConfig';
import { overviewSessions } from '../../../tracker-overview/trackerOverviewPolicy';
import { approvalApnsSender } from '../../approvalApnsSender';
import { serveSync } from '../../syncPolicy';
import type { WebApprovalPush } from '../../syncApprovalPush.types';

const handle: RequestHandler = ({ request, platform }) => {
	const config = hubEnvConfig({ ...env, ...platform?.env });
	const now = Date.now();
	const ctx = platform?.ctx;
	return serveSync(request, {
		sessions: overviewSessions(config),
		db: config.DB,
		bucket: config.CACHE,
		accounts: config.ACCOUNT_SYNC ?? null,
		now,
		approvalPush: {
			web: approvalWebSender(config, now),
			apns: approvalApnsSender(config, now),
			schedule: ctx ? (work) => ctx.waitUntil(work) : undefined
		}
	});
};

function approvalWebSender(config: HubEnv, now: number): WebApprovalPush | undefined {
	const {
		HARNESS_APPROVAL_PUSH_PUBLIC_KEY: publicKey,
		HARNESS_APPROVAL_PUSH_PRIVATE_KEY: privateKey,
		HARNESS_PUBLIC_ORIGIN: hubOrigin
	} = config;
	if (!publicKey || !privateKey || !hubOrigin || publicKey === config.HARNESS_PUSH_PUBLIC_KEY)
		return;
	return {
		publicKey,
		deliver: (target) =>
			sendWebPush(
				{ version: 1, publicKey, privateKey, hubOrigin },
				{ fetch: (url, init) => fetch(url, init), now },
				{ target, message: { kind: 'device-approval' } }
			)
	};
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
