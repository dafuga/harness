import type { HubApiRuntime } from '../../../utils/networking-security/hubRuntime';
import { createCollaboration, createGitHubRepository, createGitHubSource } from 'collaboration';
import type { HubEnv } from '../../../configs/development-tooling/hubEnvConfig';
import { HubProjectionService } from './hub-projection-service/HubProjectionService';
import {
	createHubAuth,
	createD1AuthStore
} from '../../../lib/verification-evidence/server/auth/auth';
import { hubCache } from './hubCache';
import { hubFail } from '../../../utils/development-tooling/hubJson';
import { hubRemote } from './hubRemote';

export function hubRuntime(env: HubEnv): HubApiRuntime {
	const auth = createHubAuth(env, env.DB ? createD1AuthStore(env.DB) : null);
	return {
		auth,
		remote: hubRemote(env),
		connect: () => {
			const repository = {
				id: Number(env.HARNESS_COLLABORATION_REPOSITORY_ID),
				installationId: Number(env.HARNESS_COLLABORATION_INSTALLATION_ID),
				owner: env.HARNESS_COLLABORATION_OWNER ?? '',
				name: env.HARNESS_COLLABORATION_REPO ?? '',
				private: true
			};
			if (!repository.id || !repository.installationId || !repository.owner || !repository.name)
				return hubFail('collaboration-disabled');
			const cache = hubCache(env.CACHE),
				source = createGitHubSource({ token: (input) => auth.token(input) });
			const api = createCollaboration({
				repository: createGitHubRepository({
					repository,
					token: (input) => auth.token(input),
					ref: 'refs/heads/harness-collaboration',
					path: 'collaboration.json'
				}),
				source,
				cache,
				authorizeRepository: (actor, id) => auth.authorizeRepository(actor, id)
			});
			return { api, projection: new HubProjectionService({ api, source, cache }) };
		}
	};
}
