import type { Actor } from 'collaboration';
import { test } from 'vitest';
import type { AuthEnv, HubAuth } from '../../src/models/accounts-access/HubAuth.types';
import { createHubAuth } from '../../src/lib/verification-evidence/server/auth/auth';
import { authSecrets } from '../../src/lib/verification-evidence/server/auth/authSecrets';
import { SessionRepository } from '../../src/repositories/projects-sessions/SessionRepository';
import { AuthFailure } from '../../src/utils/accounts-access/authFail';
import { memoryAuthStore } from '../support/memoryAuthStore';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

const UNIT = 'hub.module.server-auth';
const EVIDENCE = 'examples-cases';
const HUB = 'https://hub.example.com';
const LOCAL = 'http://localhost:5173';
const OTHER = 'https://other.example.org';
const SESSION_COOKIE = '__Host-harness_session';
const SESSION_SECRET = '9c4e1a7f3b8d2e6a5f0c9b1d7e3a8f4c6b2d9e0a1f5c7b3e8d4a6f2c0b9e1d7a';
const PRODUCTION_CLIENT_ID = '1038261927364-q8k3m2v7h1n4e6s9.apps.googleusercontent.com';
const LOCAL_CLIENT_ID = '508173642918-p3m7c1v9x4b6z2n8.apps.googleusercontent.com';
const GOOGLE_CREDENTIAL = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJleGFtcGxlIn0.c2lnbmF0dXJlLWV4YW1wbGU';
const CSRF = 'Kx8pQ2vN7wLr4TzB9mHc1YdEs6UfGa0J';
const REPOSITORY_ID = 123456789;
const TOKEN_INPUT = {
	installationId: 7654321,
	repositoryIds: [REPOSITORY_ID],
	permissions: { contents: 'read' as const }
};
const ACTOR: Actor = {
	id: 'google-109876543210123456789',
	email: 'member@example.com',
	name: 'Example Member',
	emailVerified: true
};
const REFUSED = { name: 'AuthFailure', code: 'github-disabled', status: 503 };

/** The contract's complete production and local settings, and the empty settings. */
const production: AuthEnv = {
	HARNESS_GOOGLE_CLIENT_ID: PRODUCTION_CLIENT_ID,
	HARNESS_SESSION_SECRET: SESSION_SECRET,
	HARNESS_PUBLIC_ORIGIN: HUB,
	HARNESS_ENVIRONMENT: 'production',
	HARNESS_EMAIL_API_KEY: 're_Jk8PqN2wXy5Lz7Vb',
	HARNESS_EMAIL_FROM: 'Harness <sign-in@hub.example.com>'
};
const local: AuthEnv = {
	HARNESS_GOOGLE_CLIENT_ID: LOCAL_CLIENT_ID,
	HARNESS_SESSION_SECRET: '4a7d1c9e2f6b8a03d5e7c1f9b2a4d6e8c0f3b5a7d9e1c3f5b7a9d1e3c5f7b9a1',
	HARNESS_PUBLIC_ORIGIN: LOCAL,
	HARNESS_ENVIRONMENT: 'local'
};
const empty: AuthEnv = {};

/** The settings that may be recorded: the session secret and the mail key stay out of evidence. */
function publicSettings(env: AuthEnv) {
	const { HARNESS_ENVIRONMENT, HARNESS_PUBLIC_ORIGIN, HARNESS_GOOGLE_CLIENT_ID } = env;
	return { HARNESS_ENVIRONMENT, HARNESS_PUBLIC_ORIGIN, HARNESS_GOOGLE_CLIENT_ID };
}

/** Status and decoded JSON body of an answer, or null when the request was not ours. */
async function answer(response: Response | null) {
	if (!response) return null;
	const body: unknown = await response.json();
	return { status: response.status, body };
}

/** A sign-in POST with a JSON body and no challenge cookie, sent from `origin`. */
function googleSignIn(origin: string): Request {
	const headers = { 'content-type': 'application/json', origin };
	const body = JSON.stringify({ credential: GOOGLE_CREDENTIAL, csrf: CSRF });
	return new Request(`${origin}/api/auth/google`, { method: 'POST', headers, body });
}

/** What a caller gets without a session: the status route, the GitHub status and a sign-in. */
async function surfaces(auth: HubAuth, origin: string) {
	return {
		status: await answer(await auth.handle(new Request(`${origin}/api/auth/status`))),
		github: await answer(await auth.handle(new Request(`${origin}/api/github/status`))),
		signIn: await answer(await auth.handle(googleSignIn(origin)))
	};
}

/** The refusal as plain values. A call that resolves is reported too, so the assertion fails. */
async function refusal(run: () => Promise<unknown>): Promise<unknown> {
	try {
		return { resolved: await run() };
	} catch (error) {
		if (!(error instanceof AuthFailure)) return { unexpected: String(error) };
		return { name: error.name, code: error.code, status: error.status };
	}
}

/** A live browser session, issued by the call the sign-in path makes. Google cannot run here. */
async function signedInSession() {
	const store = memoryAuthStore();
	const secrets = authSecrets(SESSION_SECRET);
	const sessions = new SessionRepository({ store: store.sessions, secrets, now: () => Date.now() });
	const grant = { kind: 'browser' as const, actor: ACTOR, resource: 'projects', parentHash: null };
	const { credential } = await sessions.issue(grant);
	return { store, credential };
}

/** Configured sign-in: the status route reports it, GitHub needs a session, sign-in needs a challenge. */
function configuredAnswers(clientId: string) {
	return {
		status: { status: 200, body: { actor: null, configured: true, clientId } },
		github: { status: 401, body: { error: 'session-required' } },
		signIn: { status: 401, body: { error: 'challenge-invalid' } }
	};
}

/** Disabled sign-in: every surface says so, and nobody is signed in. */
const disabledAnswers = {
	status: { status: 200, body: { actor: null, configured: false, clientId: null } },
	github: { status: 200, body: { configured: false, connected: false, login: null } },
	signIn: { status: 503, body: { error: 'auth-disabled' } }
};

test('Enables sign-in only with complete settings and a store', async () => {
	const state = 'enables-sign-in-only-with-complete-settings-and-a-store';
	const examples = [
		{ name: 'production settings with a store', env: production, origin: HUB, stored: true },
		{ name: 'local settings with a store', env: local, origin: LOCAL, stored: true },
		{ name: 'empty settings with a store', env: empty, origin: HUB, stored: true },
		{ name: 'production settings without a store', env: production, origin: HUB, stored: false }
	];
	const observed: Array<{ name: string; input: unknown; output: unknown }> = [];
	for (const { name, env, origin, stored } of examples) {
		const auth = createHubAuth(env, stored ? memoryAuthStore() : null);
		const input = { ...publicSettings(env), store: stored };
		observed.push({ name, input, output: await surfaces(auth, origin) });
	}
	expect(observed.map(({ output }) => output)).toEqual([
		configuredAnswers(PRODUCTION_CLIENT_ID),
		configuredAnswers(LOCAL_CLIENT_ID),
		disabledAnswers,
		disabledAnswers
	]);
	recordExampleCases(
		{ unitId: UNIT, symbol: 'createHubAuth', state, evidence: EVIDENCE, file: `${state}.json` },
		observed
	);
});

test('Resolves the actor only from a live session cookie', async () => {
	const state = 'resolves-the-actor-only-from-a-live-session-cookie';
	const { store, credential } = await signedInSession();
	const enabled = createHubAuth(production, store);
	const disabled = createHubAuth(empty, store);
	const cookie: Record<string, string> = { cookie: `${SESSION_COOKIE}=${credential}` };
	const bearer: Record<string, string> = { authorization: `Bearer ${credential}` };
	const none: Record<string, string> = {};
	const examples = [
		{ name: 'session cookie, sign-in configured', channel: 'cookie', auth: enabled, headers: cookie },
		{ name: 'same credential as a bearer token', channel: 'bearer', auth: enabled, headers: bearer },
		{ name: 'no credential, sign-in configured', channel: 'none', auth: enabled, headers: none },
		{ name: 'session cookie, sign-in disabled', channel: 'cookie', auth: disabled, headers: cookie }
	];
	const observed: Array<{ name: string; input: unknown; output: unknown }> = [];
	for (const { name, channel, auth, headers } of examples) {
		const output = await auth.actor(new Request(`${HUB}/api/projects`, { headers }));
		observed.push({ name, input: { path: '/api/projects', channel }, output });
	}
	expect(observed.map(({ output }) => output)).toEqual([ACTOR, null, null, null]);
	recordExampleCases(
		{ unitId: UNIT, symbol: 'actor', state, evidence: EVIDENCE, file: `${state}.json` },
		observed
	);
});

test('Answers auth routes with coded errors and skips others', async () => {
	const state = 'answers-auth-routes-with-coded-errors-and-skips-others';
	const auth = createHubAuth(production, memoryAuthStore());
	const examples = [
		{
			name: 'sign-in with no challenge cookie',
			input: { method: 'POST', path: '/api/auth/google', origin: HUB },
			request: googleSignIn(HUB)
		},
		{
			name: 'sign-in posted from another origin',
			input: { method: 'POST', path: '/api/auth/google', origin: OTHER },
			request: googleSignIn(OTHER)
		},
		{
			name: 'page outside the auth namespaces',
			input: { method: 'GET', path: '/projects' },
			request: new Request(`${HUB}/projects`)
		}
	];
	const observed: Array<{ name: string; input: unknown; output: unknown }> = [];
	for (const { name, input, request } of examples) {
		observed.push({ name, input, output: await answer(await auth.handle(request)) });
	}
	expect(observed.map(({ output }) => output)).toEqual([
		{ status: 401, body: { error: 'challenge-invalid' } },
		{ status: 403, body: { error: 'origin-denied' } },
		null
	]);
	recordExampleCases(
		{ unitId: UNIT, symbol: 'handle', state, evidence: EVIDENCE, file: `${state}.json` },
		observed
	);
});

test('Refuses repository and token calls without GitHub', async () => {
	const state = 'refuses-repository-and-token-calls-without-github';
	const examples = [
		{ name: 'sign-in configured, GitHub settings absent', env: production },
		{ name: 'sign-in disabled', env: empty }
	];
	const repositoryInput = { actor: ACTOR, repositoryId: REPOSITORY_ID };
	const observed: Array<{ name: string; input: unknown; error: unknown }> = [];
	for (const { name, env } of examples) {
		const auth = createHubAuth(env, memoryAuthStore());
		const repository = await refusal(() => auth.authorizeRepository(ACTOR, REPOSITORY_ID));
		const token = await refusal(() => auth.token(TOKEN_INPUT));
		observed.push(
			{ name: `authorizeRepository, ${name}`, input: repositoryInput, error: repository },
			{ name: `token, ${name}`, input: TOKEN_INPUT, error: token }
		);
	}
	expect(observed.map(({ error }) => error)).toEqual([REFUSED, REFUSED, REFUSED, REFUSED]);
	recordExampleCases(
		{ unitId: UNIT, symbol: 'authorizeRepository', state, evidence: EVIDENCE, file: `${state}.json` },
		observed
	);
});
