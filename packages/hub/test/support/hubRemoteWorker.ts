import type { Actor } from 'collaboration';
import { hubEnvConfig } from '../../src/configs/hubEnvConfig';
import { HubApiController } from '../../src/controllers/hub-api-controller/HubApiController';
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
	'session-other': actor('google:fixture-other', 'Other')
};

export default {
	fetch(request: Request, env: Record<string, unknown>): Promise<Response> {
		const token = request.headers.get('x-test-session') ?? '',
			session = Object.hasOwn(sessions, token) ? sessions[token] : null;
		const controller = new HubApiController({
			auth: { handle: async () => null, actor: async () => session },
			connect: () => {
				throw new Error('remote routes never open collaboration');
			},
			remote: hubRemote(hubEnvConfig(env))
		});
		return controller.handle(request);
	}
};
