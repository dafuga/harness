import { jwtVerify } from 'jose';
import { randomToken, sha256Url } from '../../src/utils/authSecrets';
import type { FakeCall, FakeRepository, FakeState } from './githubFakeState';

export type FakeHandler = (
	state: FakeState,
	call: FakeCall,
	match: RegExpExecArray
) => Promise<Response> | Response;

const json = (status: number, body: unknown) => Response.json(body, { status });
const sees = (repo: FakeRepository, user: number) =>
	repo.admins.includes(user) || repo.readers.includes(user);

function repositoryJson(repo: FakeRepository, user?: number) {
	const base = {
		id: repo.id,
		name: repo.name,
		owner: { login: repo.owner },
		private: repo.private
	};
	if (user === undefined) return base;
	return { ...base, permissions: { admin: repo.admins.includes(user), push: false, pull: true } };
}

function userOf(state: FakeState, call: FakeCall): number | null {
	const token = /^Bearer (ghu_[A-Za-z0-9_-]+)$/.exec(call.authorization ?? '')?.[1];
	const entry = token ? state.userTokens.get(token) : undefined;
	return entry && entry.expiresAt > state.now() ? entry.userId : null;
}

function issue(state: FakeState, userId: number): Response {
	const access = `ghu_${randomToken(18)}`;
	const refresh = `ghr_${randomToken(18)}`;
	const expiresAt = state.expiring ? state.now() + 28_800_000 : Number.MAX_SAFE_INTEGER;
	state.userTokens.set(access, { userId, expiresAt });
	const base = { access_token: access, token_type: 'bearer', scope: '' };
	if (!state.expiring) return json(200, base);
	state.refreshTokens.set(refresh, userId);
	const expiry = { expires_in: 28800, refresh_token: refresh, refresh_token_expires_in: 15897600 };
	return json(200, { ...base, ...expiry });
}

function refreshGrant(state: FakeState, form: URLSearchParams): Response {
	const refresh = form.get('refresh_token') ?? '';
	const userId = state.refreshTokens.get(refresh);
	state.refreshTokens.delete(refresh);
	return userId ? issue(state, userId) : json(200, { error: 'bad_refresh_token' });
}

async function codeGrant(state: FakeState, form: URLSearchParams): Promise<Response> {
	const code = state.codes.get(form.get('code') ?? '');
	state.codes.delete(form.get('code') ?? '');
	const proven = code && (await sha256Url(form.get('code_verifier') ?? '')) === code.challenge;
	if (!proven || form.get('redirect_uri') !== code.redirect) {
		return json(200, { error: 'bad_verification_code' });
	}
	return issue(state, code.userId);
}

/** GitHub answers 200 with an `error` member when a code or refresh token is refused. */
export const oauthToken: FakeHandler = async (state, call) => {
	const form = new URLSearchParams(call.body);
	const secret = form.get('client_secret') === state.app.clientSecret;
	const urlencoded = call.contentType === 'application/x-www-form-urlencoded';
	if (!urlencoded || form.get('client_id') !== state.app.clientId || !secret) {
		return json(200, { error: 'incorrect_client_credentials' });
	}
	const refreshing = form.get('grant_type') === 'refresh_token';
	const granted = await (refreshing ? refreshGrant(state, form) : codeGrant(state, form));
	if (call.accept === 'application/json') return granted;
	const fields = (await granted.json()) as Record<string, string>;
	return new Response(new URLSearchParams(fields).toString());
};

export const user: FakeHandler = (state, call) => {
	const id = userOf(state, call);
	return id ? json(200, { id, login: state.logins.get(id) }) : json(401, { message: 'Bad' });
};

export const userInstallations: FakeHandler = (state, call) => {
	const id = userOf(state, call);
	if (!id) return json(401, { message: 'Bad credentials' });
	const visible = state.installations.filter((item) =>
		item.repositories.some((repo) => sees(repo, id))
	);
	const rows = visible.map((item) => ({
		id: item.id,
		app_id: item.appId,
		suspended_at: item.suspended ? '2026-01-01T00:00:00Z' : null
	}));
	return json(200, { total_count: rows.length, installations: rows });
};

export const installationRepositories: FakeHandler = (state, call, match) => {
	const id = userOf(state, call);
	const installation = state.installations.find((item) => item.id === Number(match[1]));
	if (!id || !installation) return json(404, { message: 'Not Found' });
	const query = new URL(call.url).searchParams;
	const size = Number(query.get('per_page') ?? 30);
	const start = (Number(query.get('page') ?? 1) - 1) * size;
	const visible = installation.repositories.filter((repo) => sees(repo, id));
	const page = visible.slice(start, start + size).map((repo) => repositoryJson(repo, id));
	return json(200, { total_count: visible.length, repositories: page });
};

export const repository: FakeHandler = (state, call, match) => {
	const id = userOf(state, call);
	const found = state.installations
		.flatMap((item) => item.repositories)
		.find((repo) => repo.owner === match[1] && repo.name === match[2]);
	if (!id || !found || !sees(found, id)) return json(404, { message: 'Not Found' });
	return json(200, repositoryJson(found, id));
};

async function appAuthenticated(state: FakeState, call: FakeCall): Promise<boolean> {
	const token = /^Bearer (.+)$/.exec(call.authorization ?? '')?.[1] ?? '';
	const options = { algorithms: ['RS256'], issuer: state.app.appId };
	try {
		const verified = await jwtVerify(token, state.verifyKey, {
			...options,
			currentDate: new Date(state.now())
		});
		const { iat = 0, exp = 0 } = verified.payload;
		return exp - iat <= 600 && iat <= state.now() / 1000;
	} catch {
		return false;
	}
}

/** Requires a valid app JWT, an installation of this app, and repositories inside it. */
export const accessTokens: FakeHandler = async (state, call, match) => {
	if (!(await appAuthenticated(state, call))) return json(401, { message: 'Bad credentials' });
	const installation = state.installations.find((item) => item.id === Number(match[1]));
	if (!installation) return json(404, { message: 'Not Found' });
	if (installation.suspended) return json(403, { message: 'Suspended' });
	const body = JSON.parse(call.body) as { repository_ids: number[]; permissions: object };
	const repos = body.repository_ids.map((id) =>
		installation.repositories.find((repo) => repo.id === id)
	);
	if (repos.some((repo) => !repo)) return json(422, { message: 'Validation Failed' });
	const granted = { ...body.permissions, metadata: 'read' } as Record<string, string>;
	const permissions = state.widen ? { ...granted, administration: 'write' } : granted;
	const token = `ghs_${randomToken(18)}`;
	state.mints.push({
		installationId: installation.id,
		repositoryIds: body.repository_ids,
		permissions,
		token
	});
	return json(201, {
		token,
		expires_at: new Date(state.now() + 3_600_000).toISOString(),
		permissions,
		repository_selection: 'selected',
		repositories: repos.map((repo) => repositoryJson(repo!))
	});
};
