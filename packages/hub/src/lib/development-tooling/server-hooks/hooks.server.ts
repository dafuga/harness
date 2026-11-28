// @harness-uid u_ennjoyfyx2
import type { Handle, RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { hubEnvConfig } from '../../../configs/development-tooling/hubEnvConfig';
import {
	guardHubDeviceSession,
	needsHubDeviceGuard
} from '../../../routes/api/sync/guardHubDeviceSession';
import { overviewSessions } from '../../../routes/api/tracker-overview/trackerOverviewPolicy';
import { HubResponsesMiddleware } from './HubResponsesMiddleware';

export const handle: Handle = async ({
	event,
	resolve
}: {
	event: RequestEvent;
	resolve: Parameters<Handle>[0]['resolve'];
}) => {
	const refusal = await guard(event);
	return new HubResponsesMiddleware().handle(refusal ?? (await resolve(event)));
};

async function guard({ request, platform }: RequestEvent) {
	if (!needsHubDeviceGuard(request)) return;
	const config = hubEnvConfig({ ...env, ...platform?.env });
	if (!config.DB) return;
	try {
		const session = (await overviewSessions(config)?.resolve(request)) ?? null;
		return await guardHubDeviceSession(request, config.DB, session, Date.now());
	} catch {
		return Response.json({ error: 'unavailable' }, { status: 503 });
	}
}
