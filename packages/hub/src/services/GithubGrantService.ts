import type { Actor } from 'collaboration';
import type { GithubApiAdapter } from '../adapters/GithubApiAdapter';
import type { GithubStatus } from '../models/HubAuth.types';
import type {
	AuthStore,
	GithubGrantRecord,
	GrantState,
	SessionRecord
} from '../models/HubAuthStore.types';
import type { GithubAppConfig } from '../utils/authConfig';
import { authFail } from '../utils/authFail';
import { randomToken, sha256Url } from '../utils/authSecrets';
import type { AuthSecrets } from '../utils/authSecrets';
import type { GithubUser, GithubUserToken } from '../validators/GithubResponseValidator';

export const STATE_TTL = 10 * 60 * 1000;
export const GRANT_TTL = 30 * 24 * 60 * 60 * 1000;
/** How long one caller may hold the right to rotate a grant's tokens. */
export const REFRESH_LEASE = 30 * 1000;
const EXPIRY_MARGIN = 60 * 1000;
const AUTHORIZE = 'https://github.com/login/oauth/authorize';

export interface GithubGrantOptions {
	app: GithubAppConfig;
	api: GithubApiAdapter;
	store: Pick<AuthStore, 'githubStates' | 'grants'>;
	secrets: AuthSecrets;
	origin: string;
	now: () => number;
}

interface GrantProof {
	user: GithubUser;
	token: GithubUserToken;
}
type Lifetime = Pick<GithubGrantRecord, 'createdAt' | 'expiresAt'>;

/** Additional data for sealing: a sealed token opens only for the actor it was sealed for. */
function sealContext(actorId: string): string {
	return `github-grant:${actorId}`;
}

function after(now: number, seconds: number | null): number | null {
	return seconds === null ? null : now + seconds * 1000;
}

async function sealed(
	options: GithubGrantOptions,
	actorId: string,
	proof: GrantProof,
	lifetime: Lifetime
): Promise<GithubGrantRecord> {
	const { secrets, now } = options;
	const { user, token } = proof;
	const refresh = token.refreshToken;
	return {
		actorId,
		githubUserId: user.id,
		login: user.login,
		tokenCipher: await secrets.seal(token.accessToken, sealContext(actorId)),
		tokenExpiresAt: after(now(), token.expiresIn),
		refreshCipher: refresh === null ? null : await secrets.seal(refresh, sealContext(actorId)),
		refreshExpiresAt: after(now(), token.refreshExpiresIn),
		createdAt: lifetime.createdAt,
		expiresAt: lifetime.expiresAt
	};
}

function callbackUrl(options: GithubGrantOptions): string {
	return `${options.origin}/api/github/callback`;
}

/** The code for a user token and the GitHub user behind it. Throws when GitHub refuses either. */
async function exchanged(
	options: GithubGrantOptions,
	flow: { sessionHash: string; verifierCipher: string; code: string }
): Promise<GrantProof> {
	const { app, api, secrets } = options;
	const verifier = await secrets.open(flow.verifierCipher, `github-state:${flow.sessionHash}`);
	const client = { client_id: app.clientId, client_secret: app.clientSecret };
	const proof = {
		code: flow.code,
		redirect_uri: callbackUrl(options),
		code_verifier: verifier ?? ''
	};
	const token = verifier ? await api.userToken({ ...client, ...proof }) : null;
	const user = token ? await api.user(token.accessToken) : null;
	return token && user ? { user, token } : authFail('github-not-connected');
}

/** Null when GitHub refuses the refresh token or answers for another GitHub user. */
async function rotated(
	options: GithubGrantOptions,
	grant: GithubGrantRecord
): Promise<GrantProof | null> {
	const { app, api, secrets, now } = options;
	const usable = grant.refreshCipher !== null && (grant.refreshExpiresAt ?? 0) > now();
	const context = sealContext(grant.actorId);
	const refresh = usable ? await secrets.open(grant.refreshCipher ?? '', context) : null;
	const client = { client_id: app.clientId, client_secret: app.clientSecret };
	const token = refresh
		? await api.userToken({ ...client, grant_type: 'refresh_token', refresh_token: refresh })
		: null;
	const user = token ? await api.user(token.accessToken) : null;
	return token && user?.id === grant.githubUserId ? { user, token } : null;
}

/**
 * Links a signed-in Google actor to a GitHub user through the app's OAuth flow with PKCE.
 * Nothing here reads and then writes: a connection is published against the generation its flow
 * started from, a rotation under a lease, and a disconnect outdates both.
 */
export class GithubGrantService {
	constructor(private readonly options: GithubGrantOptions) {}

	/** The authorize URL for this browser session. State and verifier are kept server-side. */
	async begin(session: SessionRecord): Promise<string> {
		const { app, store, secrets, now } = this.options;
		const state = randomToken();
		const verifier = randomToken();
		await store.githubStates.create({
			idHash: await secrets.hash('github-state', state),
			sessionHash: session.idHash,
			actorId: session.actor.id,
			grantGeneration: (await store.grants.read(session.actor.id)).generation,
			verifierCipher: await secrets.seal(verifier, `github-state:${session.idHash}`),
			expiresAt: now() + STATE_TTL
		});
		const challenge = { code_challenge: await sha256Url(verifier), code_challenge_method: 'S256' };
		const client = { client_id: app.clientId, redirect_uri: callbackUrl(this.options), state };
		return `${AUTHORIZE}?${new URLSearchParams({ ...client, ...challenge })}`;
	}

	/** Finishes the round trip for the session that began it, unless the generation has moved. */
	async complete(session: SessionRecord, input: { code: string; state: string }): Promise<void> {
		const { store, secrets, now } = this.options;
		const stateHash = await secrets.hash('github-state', input.state);
		const record = await store.githubStates.claim(stateHash, now());
		if (record?.sessionHash !== session.idHash || record.actorId !== session.actor.id) {
			return authFail('github-not-connected');
		}
		const flow = { sessionHash: session.idHash, verifierCipher: record.verifierCipher };
		const proof = await exchanged(this.options, { ...flow, code: input.code });
		const createdAt = now();
		const lifetime = { createdAt, expiresAt: createdAt + GRANT_TTL };
		const grant = await sealed(this.options, session.actor.id, proof, lifetime);
		const connected = await store.grants.connect(record.grantGeneration, grant);
		if (!connected) return authFail('github-not-connected');
	}

	async status(actor: Actor): Promise<GithubStatus> {
		const { grant } = await this.read(actor.id);
		return { configured: true, connected: grant !== null, login: grant?.login ?? null };
	}

	/** Leaves a tombstone, so a connection or rotation still in flight cannot write back. */
	async disconnect(actor: Actor): Promise<void> {
		await this.options.store.grants.revoke(actor.id, this.options.now());
	}

	/** The actor's GitHub user token, rotated first when GitHub has expired it. */
	async userToken(actor: Actor): Promise<string> {
		const { generation, grant } = await this.read(actor.id);
		if (grant && !this.fresh(grant)) return this.refresh(grant, generation);
		return this.stored(grant);
	}

	/** One caller rotates. Its result counts only if it still holds the lease when it returns. */
	private async refresh(grant: GithubGrantRecord, generation: number): Promise<string> {
		const { store, now } = this.options;
		const { actorId } = grant;
		const lease = { actorId, generation, now: now(), until: now() + REFRESH_LEASE };
		if (!(await store.grants.lease(lease))) return this.settled(actorId);
		const proof = await rotated(this.options, grant);
		if (!proof) {
			await store.grants.revokeLeased(lease, now());
			return this.settled(actorId);
		}
		const record = await sealed(this.options, actorId, proof, grant);
		const published = await store.grants.rotate(lease, record);
		return published ? proof.token.accessToken : this.settled(actorId);
	}

	/** After a lost race: the token now in force, never the one this caller obtained. */
	private async settled(actorId: string): Promise<string> {
		const { grant } = await this.read(actorId);
		if (grant && !this.fresh(grant)) return authFail('github-unavailable');
		return this.stored(grant);
	}

	private async stored(grant: GithubGrantRecord | null): Promise<string> {
		const context = sealContext(grant?.actorId ?? '');
		const token = grant ? await this.options.secrets.open(grant.tokenCipher, context) : null;
		return token ?? authFail('github-not-connected');
	}

	/** The stored state, with a grant that is past its lifetime read as no grant. */
	private async read(actorId: string): Promise<GrantState> {
		const state = await this.options.store.grants.read(actorId);
		const live = state.grant?.actorId === actorId && state.grant.expiresAt > this.options.now();
		return live ? state : { ...state, grant: null };
	}

	private fresh(grant: GithubGrantRecord): boolean {
		const expiry = grant.tokenExpiresAt;
		return expiry === null || expiry - EXPIRY_MARGIN > this.options.now();
	}
}
