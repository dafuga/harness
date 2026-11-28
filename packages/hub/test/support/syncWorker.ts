import type { TestEnv } from './syncWorker.types';
import type { SessionRecord } from '../../src/models/accounts-access/HubAuthStore.types';
import { guardHubDeviceSession } from '../../src/routes/api/sync/guardHubDeviceSession';
import { serveSync } from '../../src/routes/api/sync/syncPolicy';

/**
 * TEST ONLY. The sealed sync API as a Worker, for a test that runs it in workerd beside the
 * relay's account objects. A verified session is stood in for by an opaque token that this Worker
 * maps to an actor; a browser-style WebSocket cannot set headers, so `?session=` and `?device=`
 * stand in for the two headers on a socket upgrade.
 */
const actors: Record<string, string> = {
	'session-a': 'google:fixture-a',
	'session-a-browser': 'google:fixture-a',
	'session-a-secondary': 'google:fixture-a',
	'session-b': 'google:fixture-b'
};

function withHeaders(request: Request): Request {
	const url = new URL(request.url);
	const headers = new Headers(request.headers);
	for (const [query, header] of [
		['session', 'x-test-session'],
		['device', 'x-harness-device']
	] as const) {
		const value = url.searchParams.get(query);
		if (value && !headers.has(header)) headers.set(header, value);
	}
	return new Request(request, { headers });
}

/**
 * Local workerd can drop the connection when a Worker answers while the caller is still uploading,
 * and the refusal is lost. This reads whatever the sync API left unread.
 */
async function drain(request: Request): Promise<void> {
	if (!request.bodyUsed) await request.body?.pipeTo(new WritableStream());
}

export default {
	async fetch(request: Request, env: TestEnv): Promise<Response> {
		const framed = withHeaders(request);
		const token = framed.headers.get('x-test-session') ?? '';
		const id = Object.hasOwn(actors, token) ? actors[token] : null;
		const record = id
			? ({
					idHash: 'test-' + token,
					actor: { id },
					kind: 'native',
					resource: 'projects'
				} as SessionRecord)
			: null;
		if (new URL(request.url).pathname === '/api/projects')
			return (await guardHubDeviceSession(framed, env.DB, record, Date.now())) ?? Response.json([]);
		const response = await serveSync(framed, {
			sessions: { resolve: async () => record },
			db: env.DB,
			bucket: env.CACHE,
			accounts: env.ACCOUNT_SYNC,
			now: Date.now()
		});
		await drain(framed);
		return response;
	}
};
