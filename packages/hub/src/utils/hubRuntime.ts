import { createCollaboration, createGitHubRepository, createGitHubSource } from 'collaboration';
import type { CollaborationApi } from 'collaboration';
import type { HubEnv } from '../config/hubEnvConfig';
import { HubProjectionService } from '../services/HubProjectionService';
import { createHubAuth, createD1AuthStore } from '../lib/server/auth';
import type { HubAuth } from '../lib/server/auth';
import { hubCache } from './hubCache';
import { hubFail } from './hubJson';
import { hubRemote } from './hubRemote';
import type { HubRemoteRuntime } from './hubRemote';
export interface HubApiRuntime {
	auth: Pick<HubAuth, 'actor' | 'handle'>;
	connect(): { api: CollaborationApi; projection: HubProjectionService };
	/** Null or absent when the relay binding or its origin is not configured. */
	remote?: HubRemoteRuntime | null;
}
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
