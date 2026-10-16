import type { Handle } from '@sveltejs/kit';
import { HubResponsesMiddleware } from './middleware/HubResponsesMiddleware';

export const handle: Handle = async ({ event, resolve }) =>
	new HubResponsesMiddleware().handle(await resolve(event));
