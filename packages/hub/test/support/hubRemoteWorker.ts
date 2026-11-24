import type { SessionRecord } from '../../src/models/accounts-access/HubAuthStore.types';
import type { Actor } from 'collaboration';
import { hubEnvConfig } from '../../src/configs/development-tooling/hubEnvConfig';
import { HubApiController } from '../../src/routes/api/[...path]/hub-api-controller/HubApiController';
import { hubRemote } from '../../src/routes/api/[...path]/hubRemote';

/**
 * TEST ONLY. The hub's own API controller as a Worker, for a test that runs it in workerd beside
 * the relay. A verified session is stood in for by an opaque token that this Worker maps to an
 * actor: that table is the trust boundary of the test. Nothing in a request body or address can
 * name the actor, exactly as with a real session.
 */
const actor = (id: string, name: string): Actor => ({
	id,
	name,
	email: `${name.toLowerCase()}@gmail.com`,
	emailVerified: true
});
const sessions: Record<string, Actor> = {
	'session-owner': actor('google:fixture-owner', 'Owner'),
	'session-other': actor('google:fixture-other', 'Other'),
	'session-browser': actor('google:fixture-owner', 'Owner'),
	'session-browser-second': actor('google:fixture-owner', 'Owner')
};

export default {
	fetch(request: Request, env: Record<string, unknown>): Promise<Response> {
		const token = request.headers.get('x-test-session') ?? '',
			session = Object.hasOwn(sessions, token) ? sessions[token] : null;
		const verified: SessionRecord | null = session
			? {
					actor: session,
					idHash: (Object.keys(sessions).indexOf(token) + 1).toString(16).repeat(64),
					kind: token === 'session-owner' ? 'native' : 'browser',
					parentHash: null,
					resource: 'projects',
					createdAt: 0,
					expiresAt: Number.MAX_SAFE_INTEGER,
					revokedAt: null
				}
			: null;
		const controller = new HubApiController({
			auth: { handle: async () => null, actor: async () => session, session: async () => verified },
			connect: () => {
				throw new Error('remote routes never open collaboration');
			},
			remote: hubRemote(hubEnvConfig(env))
		});
		return controller.handle(request);
	}
};
