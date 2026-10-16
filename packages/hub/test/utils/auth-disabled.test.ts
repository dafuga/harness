import { afterEach, expect, test, vi } from 'vitest';
import { createD1AuthStore, createHubAuth } from '../../src/lib/server/auth';
import type { AuthChallenge } from '../../src/lib/server/auth';
import { GOOGLE_JWKS_URL } from '../../src/services/GoogleIdentityService';
import { SESSION_COOKIE } from '../../src/utils/authCookies';
import { ORIGIN, SECRET, ada } from '../support/authFixture';
import { failure } from '../support/githubFixture';
import { CLIENT_ID, START, googleFixture } from '../support/googleFixture';
import { HubBrowser } from '../support/hubBrowser';
import { errorOf } from '../support/hubFixture';
import { memoryAuthStore } from '../support/memoryAuthStore';

const env = {
	HARNESS_GOOGLE_CLIENT_ID: CLIENT_ID,
	HARNESS_SESSION_SECRET: SECRET,
	HARNESS_PUBLIC_ORIGIN: ORIGIN,
	HARNESS_ENVIRONMENT: 'staging'
};

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

test('without configuration every sign-in route is disabled and nobody is an actor', async () => {
	for (const auth of [createHubAuth({}, null), createHubAuth(env, null)]) {
		const browser = new HubBrowser(auth);
		expect(await (await browser.get('/api/auth/status')).json()).toEqual({
			actor: null,
			configured: false,
			clientId: null
		});
		expect(await errorOf(await browser.post('/api/auth/challenge'))).toBe('503 auth-disabled');
		expect(await errorOf(await browser.post('/api/auth/native/start'))).toBe('503 auth-disabled');
		expect(await (await browser.get('/api/github/status')).json()).toMatchObject({
			configured: false
		});
		expect(await auth.handle(new Request(`${ORIGIN}/api/projects`))).toBeNull();
	}
});

test('a disabled hub accepts no credential and issues no token', async () => {
	const short = { ...env, HARNESS_SESSION_SECRET: 'too-short' };
	const auth = createHubAuth(short, memoryAuthStore());
	const cookie = { cookie: `${SESSION_COOKIE}=${'a'.repeat(43)}` };
	const bearer = { authorization: `Bearer ${'a'.repeat(43)}` };
	for (const headers of [cookie, bearer, { 'x-actor-id': ada.id }]) {
		expect(await auth.actor(new Request(`${ORIGIN}/api/projects`, { headers }))).toBeNull();
	}
	const disabled = 'Hub auth github-disabled';
	expect(await failure(auth.authorizeRepository(ada, 9001))).toBe(disabled);
	const scope = { installationId: 71, repositoryIds: [9001] };
	expect(await failure(auth.token({ ...scope, permissions: { contents: 'read' } }))).toBe(disabled);
});

test('createHubAuth takes an environment and a store and nothing that could inject keys', () => {
	expect(createHubAuth.length).toBe(2);
	expect(createD1AuthStore.length).toBe(1);
	expect(GOOGLE_JWKS_URL).toBe('https://www.googleapis.com/oauth2/v3/certs');
});

test('the production composition fetches keys only from the fixed Google endpoint', async () => {
	vi.useFakeTimers({ now: START, toFake: ['Date'] });
	const google = await googleFixture(() => START);
	const fetched: string[] = [];
	vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
		fetched.push(String(input instanceof Request ? input.url : input));
		return Response.json(google.jwks);
	});
	const browser = new HubBrowser(createHubAuth(env, memoryAuthStore()));
	const challenge = async () =>
		(await (await browser.post('/api/auth/challenge')).json()) as AuthChallenge;
	const { nonce, csrf } = await challenge();
	const forged = await google.forge(google.claims(nonce));
	const refused = await browser.post('/api/auth/google', { credential: forged, csrf });
	expect(await errorOf(refused)).toBe('401 credential-invalid');
	const next = await challenge();
	const credential = await google.sign(google.claims(next.nonce));
	const signedIn = await browser.post('/api/auth/google', { credential, csrf: next.csrf });
	expect(await signedIn.json()).toEqual({ actor: ada });
	expect(new Set(fetched)).toEqual(new Set([GOOGLE_JWKS_URL]));
});
