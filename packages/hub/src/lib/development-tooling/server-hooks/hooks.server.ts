// @harness-uid u_ennjoyfyx2
import type { Handle } from '@sveltejs/kit';
import { HubResponsesMiddleware } from './HubResponsesMiddleware';

export const handle: Handle = async ({ event, resolve }) =>
	new HubResponsesMiddleware().handle(await resolve(event));
