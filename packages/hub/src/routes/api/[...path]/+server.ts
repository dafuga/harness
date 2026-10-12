import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { hubEnvConfig } from '../../../config/hubEnvConfig';
import { hubRuntime } from '../../../utils/hubRuntime';
import { HubApiController } from '../../../controllers/HubApiController';
import { hubRateLimit } from '../../../utils/hubRateLimit';
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
