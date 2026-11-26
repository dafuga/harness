import type { TestEnv } from './syncWorker.types';
import type { SessionRecord } from '../../src/models/accounts-access/HubAuthStore.types';
import { serveHubHome } from '../../src/routes/api/hub-home/homePolicy';
import { macToken } from './realtimeToken';
import { serveSync } from '../../src/routes/api/sync/syncPolicy';

/**
 * TEST ONLY. The Hub's own Home and sync policies in workerd beside the relay's account object.
 * Sessions are stood in for: a bearer token is the Mac's native session, the browser header or
 * cookie-less upgrade is the same owner's browser session.
 */
const owner = 'google:fixture-owner';

function session(request: Request): SessionRecord {
	const native = request.headers.get('Authorization') === `Bearer ${macToken}`;
	return {
		actor: { id: owner },
		kind: native ? 'native' : 'browser',
		resource: 'projects'
	} as SessionRecord;
}

export default {
	fetch(request: Request, env: TestEnv): Promise<Response> {
		const sessions = { resolve: async () => session(request) };
		const shared = { sessions, db: env.DB, accounts: env.ACCOUNT_SYNC, now: Date.now() };
		return new URL(request.url).pathname.startsWith('/api/sync/')
			? serveSync(request, { ...shared, bucket: env.CACHE })
			: serveHubHome(request, { ...shared, bucket: env.CACHE, ownerId: owner });
	}
};
