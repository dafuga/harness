import { serveHubHome } from '../../../src/routes/api/hub-home/homePolicy';
import type { SessionRecord } from '../../../src/models/accounts-access/HubAuthStore.types';
import remoteRoutes from '../../../test/support/hubRemoteWorker';
import type { ChainHubEnv } from './chainHubWorker.types';

/**
 * TEST ONLY. The Hub's own Home and remote-computer routes in workerd, beside the real relay.
 * Google sign-in is the one stand-in: two opaque tokens are the owner's Mac and browser
 * sessions. `/v1/` is the relay's own address, served here so that both share one origin.
 */
const owner = {
	id: 'google:fixture-owner',
	name: 'Owner',
	email: 'owner@gmail.com',
	emailVerified: true
};
const kinds: Record<string, SessionRecord['kind']> = {
	'session-owner': 'native',
	'session-browser': 'browser'
};

function signedIn(request: Request): SessionRecord | null {
	const kind = kinds[request.headers.get('x-test-session') ?? ''];
	return kind ? ({ actor: owner, kind, resource: 'projects' } as SessionRecord) : null;
}

/** The installed Mac sends its session as a bearer token, and nothing else. */
function withSession(request: Request): Request {
	const bearer = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
	if (!Object.hasOwn(kinds, bearer)) return request;
	const headers = new Headers(request.headers);
	headers.set('x-test-session', bearer);
	return new Request(request, { headers });
}

export default {
	fetch(request: Request, env: ChainHubEnv): Promise<Response> | Response {
		const { pathname } = new URL(request.url);
		if (pathname.startsWith('/v1/')) return env.RELAY.fetch(request);
		const framed = withSession(request);
		if (pathname === '/api/auth/status')
			return Response.json({ actor: signedIn(framed)?.actor ?? null, configured: true });
		if (pathname.startsWith('/api/remote/')) return remoteRoutes.fetch(framed, { ...env });
		return serveHubHome(framed, {
			ownerId: owner.id,
			sessions: { resolve: async (incoming) => signedIn(incoming) },
			bucket: env.CACHE,
			db: env.DB,
			accounts: null,
			now: Date.now()
		});
	}
};
