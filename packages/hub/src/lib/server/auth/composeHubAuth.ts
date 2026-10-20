import type { HubAuthParts } from '../../../utils/composeHubAuth';
import { GithubApiAdapter } from './GithubApiAdapter';
import { EmailProofController } from './EmailProofController';
import { GithubConnectionController } from './github-connection-controller/GithubConnectionController';
import { HubAuthController } from './HubAuthController';
import { NativeHandoffController } from './NativeHandoffController';
import type { HubAuth } from '../../../models/HubAuth.types';
import { SessionRepository } from '../../../repositories/SessionRepository';
import { EmailProofService } from '../../../services/email-proof-service/EmailProofService';
import { GithubGrantService } from './GithubGrantService';
import { GithubOwnerService } from './GithubOwnerService';
import { InstallationTokenService } from './installation-token-service/InstallationTokenService';
import { LoginChallengeService } from '../../../services/LoginChallengeService';
import { NativeHandoffService } from './native-handoff-service/NativeHandoffService';
import { RequestSessionService } from './request-session-service/RequestSessionService';
import { AuthFailure } from '../../../utils/authFail';
import { authSecrets } from './authSecrets';
import type { AuthSecrets } from '../../../utils/authSecrets';

function githubServices(parts: HubAuthParts, secrets: AuthSecrets) {
	const { config, store, now } = parts;
	const app = config.github;
	if (!app) return null;
	const api = new GithubApiAdapter({ fetch: parts.fetch });
	const tokens = new InstallationTokenService({ app, api, cache: parts.tokenCache, now });
	const grant = { app, api, store, secrets, origin: config.origin, now };
	const grants = new GithubGrantService(grant);
	const owner = new GithubOwnerService({ grants, tokens, api, appId: Number(app.appId) });
	return { grants, owner, tokens };
}

/** Wires configured authentication. Every returned function is safe to pass around detached. */
export function composeHubAuth(parts: HubAuthParts): HubAuth {
	const { config, store, now } = parts;
	const { origin, environment } = config;
	const secrets = authSecrets(config.secret);
	const repository = new SessionRepository({ store: store.sessions, secrets, now });
	const sessions = new RequestSessionService({ sessions: repository, origin });
	const github = githubServices(parts, secrets);
	const scope = { store: store.exchanges, sessions: repository, secrets, origin, environment };
	const handoff = new NativeHandoffService({ ...scope, now });
	const native = new NativeHandoffController({ handoff, sessions });
	const connection = new GithubConnectionController({ origin, sessions, github });
	const proof = { store, sessions: repository, secrets, delivery: parts.delivery, now };
	const emailProofs = new EmailProofService(proof);
	const email = new EmailProofController({ proofs: emailProofs, sessions });
	const controller = new HubAuthController({
		clientId: config.clientId,
		sessions,
		repository,
		challenges: new LoginChallengeService({ store: store.challenges, secrets, now }),
		google: parts.google,
		emailProofs,
		routes: { ...native.routes(), ...connection.routes(), ...email.routes() }
	});
	const refuse = () => Promise.reject(new AuthFailure('github-disabled'));
	return {
		actor: async (request) => (await sessions.resolve(request))?.actor ?? null,
		handle: (request) => controller.handle(request),
		authorizeRepository: (actor, repositoryId) =>
			github ? github.owner.authorizeRepository(actor, repositoryId) : refuse(),
		token: (input) => (github ? github.tokens.token(input) : refuse())
	};
}
