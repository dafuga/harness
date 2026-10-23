import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { hubEnvConfig } from '../../../configs/development-tooling/hubEnvConfig';
import { hubRuntime } from './hubRuntime';
import { HubApiController } from './hub-api-controller/HubApiController';
import { hubRateLimit } from './hubRateLimit';

const handler: RequestHandler = async ({ request, platform }) => {
	const config = hubEnvConfig({ ...env, ...platform?.env });
	const limited = await hubRateLimit({
		request,
		db: config.DB,
		secret: config.HARNESS_SESSION_SECRET,
		ip: request.headers.get('CF-Connecting-IP') ?? undefined
	});
	return limited ?? new HubApiController(hubRuntime(config)).handle(request);
};

export const GET = handler;

export const POST = handler;

export const DELETE = handler;

export const PUT = handler;

export const PATCH = handler;
