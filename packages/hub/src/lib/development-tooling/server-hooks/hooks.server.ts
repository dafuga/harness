// @harness-uid u_ennjoyfyx2
import type { Handle, RequestEvent } from '@sveltejs/kit';
import { HubResponsesMiddleware } from './HubResponsesMiddleware';

export const handle: Handle = async ({
	event,
	resolve
}: {
	event: RequestEvent;
	resolve: Parameters<Handle>[0]['resolve'];
}) => new HubResponsesMiddleware().handle(await resolve(event));
