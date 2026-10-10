import type { Handle } from '@sveltejs/kit';
import { consoleServer } from './utils/consoleServer';
import { reportBuildIdentity } from './utils/reportBuildIdentity';

// Read once at start: the identity is of the files this process was started from.
reportBuildIdentity();

/** Every page, API, data, media and export request passes the owner policy before anything runs. */
export const handle: Handle = async ({ event, resolve }) => {
	const denied = await consoleServer().guard(event);
	return denied ?? resolve(event);
};
