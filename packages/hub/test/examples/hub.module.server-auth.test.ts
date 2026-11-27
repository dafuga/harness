import type { Actor } from 'collaboration';
import { test } from 'vitest';
import { createHubAuth } from '../../src/lib/verification-evidence/server/auth/auth';
import { authSecrets } from '../../src/lib/verification-evidence/server/auth/authSecrets';
import { SessionRepository } from '../../src/repositories/projects-sessions/SessionRepository';
import { AuthFailure } from '../../src/utils/accounts-access/authFail';
import { memoryAuthStore } from '../support/memoryAuthStore';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	SESSION_SECRET,
	production,
	empty,
	HUB,
	UNIT,
	EVIDENCE,
	googleSignIn,
	answer
} from './hub.module.server-auth.cases';

const OTHER = 'https://other.example.org';
const SESSION_COOKIE = '__Host-harness_session';
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

test('Resolves the actor only from a live session cookie', async () => {
	const state = 'resolves-the-actor-only-from-a-live-session-cookie';
	const { store, credential } = await signedInSession();
	const enabled = createHubAuth(production, store);
	const disabled = createHubAuth(empty, store);
	const cookie: Record<string, string> = { cookie: `${SESSION_COOKIE}=${credential}` };
	const bearer: Record<string, string> = { authorization: `Bearer ${credential}` };
	const none: Record<string, string> = {};
	const examples = [
		{
			name: 'session cookie, sign-in configured',
			channel: 'cookie',
			auth: enabled,
			headers: cookie
		},
		{
			name: 'same credential as a bearer token',
			channel: 'bearer',
			auth: enabled,
			headers: bearer
		},
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
		{
			unitId: UNIT,
			symbol: 'authorizeRepository',
			state,
			evidence: EVIDENCE,
			file: `${state}.json`
		},
		observed
	);
});
