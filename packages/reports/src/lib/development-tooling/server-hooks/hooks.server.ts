import { ConsoleAgentController } from './ConsoleAgentController';
import type { Handle } from '@sveltejs/kit';
import { consoleServer } from '../../../utils/explorer-ui/console-server/consoleServer';
import { reportBuildIdentity } from '../../../utils/reports-media/reportBuildIdentity';

// Read once at start: the identity is of the files this process was started from.
reportBuildIdentity();

/** Every page, API, data, media and export request passes the owner policy before anything runs. */
export const handle: Handle = async ({ event, resolve }) => {
	const denied = await consoleServer().guard(event);
	if (denied) return denied;
	const response =
		event.url.pathname === '/api/agent'
			? await new ConsoleAgentController().handle(event.request)
			: await resolve(event);
	// What the owner is shown is the owner's: no shared cache may keep a page, a redirect or data.
	if (!response.headers.has('cache-control')) {
		response.headers.set('cache-control', 'private, no-store');
	}
	return response;
};
