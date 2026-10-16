import { expect, test } from 'vitest';
import { CHALLENGE_COOKIE, SESSION_COOKIE } from '../../src/utils/authCookies';
import { ada } from '../support/authFixture';
import { CLIENT_ID } from '../support/googleFixture';
import { errorOf, hubFixture } from '../support/hubFixture';

test('status is public and reports the client id without an actor', async () => {
	const hub = await hubFixture();
	const response = await hub.browser().get('/api/auth/status');
	expect(await response.json()).toEqual({ actor: null, configured: true, clientId: CLIENT_ID });
	expect(response.headers.get('cache-control')).toBe('no-store');
});

test('a challenge is a short-lived, same-site, script-invisible cookie plus nonce and CSRF', async () => {
	const hub = await hubFixture();
	const browser = hub.browser();
	const challenge = await hub.challenge(browser);
	expect(challenge.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
	expect(challenge.csrf).toMatch(/^[A-Za-z0-9_-]{43}$/);
	const [cookie] = browser.setCookies;
	expect(cookie).toMatch(
		new RegExp(
			`^${CHALLENGE_COOKIE}=[\\w-]{43}; Path=/; Max-Age=300; HttpOnly; Secure; SameSite=Strict$`
		)
	);
	expect(cookie).not.toContain(challenge.csrf);
	expect(cookie).not.toContain(challenge.nonce);
});

test('a verified Google credential opens an opaque, HttpOnly, Secure, SameSite session', async () => {
	const hub = await hubFixture();
	const browser = hub.browser();
	const response = await hub.signIn(browser);
	const body = await response.text();
	expect(JSON.parse(body)).toEqual({ actor: ada });
	const session = browser.cookies.get(SESSION_COOKIE) ?? '';
	expect(browser.setCookies).toContain(
		`${SESSION_COOKIE}=${session}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`
	);
	expect(session).toMatch(/^[A-Za-z0-9_-]{43}$/);
	expect(body).not.toContain(session);
	expect(hub.store.dump()).not.toContain(session);
	expect(browser.cookies.has(CHALLENGE_COOKIE)).toBe(false);
	expect(await (await browser.get('/api/auth/status')).json()).toMatchObject({ actor: ada });
	expect(await hub.auth.actor(browser.request('/api/projects'))).toEqual(ada);
});

test('a wrong CSRF value is refused and spends the challenge', async () => {
	const hub = await hubFixture();
	const browser = hub.browser();
	const { nonce, csrf } = await hub.challenge(browser);
	const credential = await hub.google.sign(hub.google.claims(nonce));
	const forged = await browser.post('/api/auth/google', { credential, csrf: 'x'.repeat(43) });
	expect(await errorOf(forged)).toBe('401 challenge-invalid');
	const retry = await browser.post('/api/auth/google', { credential, csrf });
	expect(await errorOf(retry)).toBe('401 challenge-invalid');
	expect(browser.cookies.has(SESSION_COOKIE)).toBe(false);
});

test('a sign-in posted from another origin is refused before the challenge is touched', async () => {
	const hub = await hubFixture();
	const browser = hub.browser();
	const { nonce, csrf } = await hub.challenge(browser);
	const body = { credential: await hub.google.sign(hub.google.claims(nonce)), csrf };
	for (const origin of ['https://evil.example', 'null', '']) {
		const response = await browser.post('/api/auth/google', body, { origin });
		expect(await errorOf(response)).toBe('403 origin-denied');
	}
	expect(await errorOf(await browser.post('/api/auth/challenge', {}, { origin: '' }))).toBe(
		'403 origin-denied'
	);
	expect((await browser.post('/api/auth/google', body)).status).toBe(200);
});

test('a credential is bound to the nonce of the challenge it is presented with', async () => {
	const hub = await hubFixture();
	const browser = hub.browser();
	const first = await hub.challenge(browser);
	const credential = await hub.google.sign(hub.google.claims(first.nonce));
	expect((await browser.post('/api/auth/google', { credential, csrf: first.csrf })).status).toBe(
		200
	);
	const victim = hub.browser();
	const second = await hub.challenge(victim);
	const replay = await victim.post('/api/auth/google', { credential, csrf: second.csrf });
	expect(await errorOf(replay)).toBe('401 credential-invalid');
	expect(victim.cookies.has(SESSION_COOKIE)).toBe(false);
});

test('a challenge cookie from another browser cannot be combined with a stolen CSRF value', async () => {
	const hub = await hubFixture();
	const victim = hub.browser();
	const { nonce, csrf } = await hub.challenge(victim);
	const credential = await hub.google.sign(hub.google.claims(nonce));
	const attacker = hub.browser();
	await hub.challenge(attacker);
	const stolen = await attacker.post('/api/auth/google', { credential, csrf });
	expect(await errorOf(stolen)).toBe('401 challenge-invalid');
	const bare = await hub.browser().post('/api/auth/google', { credential, csrf });
	expect(await errorOf(bare)).toBe('401 challenge-invalid');
});

test('forged, expired and wrong-audience credentials open no session', async () => {
	const hub = await hubFixture();
	const attempt = async (make: (nonce: string) => Promise<string>) => {
		const browser = hub.browser();
		const { nonce, csrf } = await hub.challenge(browser);
		const response = await browser.post('/api/auth/google', {
			credential: await make(nonce),
			csrf
		});
		expect(browser.cookies.has(SESSION_COOKIE)).toBe(false);
		return errorOf(response);
	};
	const { google } = hub;
	const past = Math.floor(hub.now() / 1000) - 60;
	expect(await attempt((nonce) => google.forge(google.claims(nonce)))).toBe(
		'401 credential-invalid'
	);
	expect(await attempt((nonce) => google.sign(google.claims(nonce, { exp: past })))).toBe(
		'401 credential-invalid'
	);
	expect(await attempt((nonce) => google.sign(google.claims(nonce, { aud: 'other' })))).toBe(
		'401 credential-invalid'
	);
});

test('an address Google does not vouch for opens no session at sign-in', async () => {
	const hub = await hubFixture();
	const browser = hub.browser();
	const response = await hub.signIn(browser, { email: 'ada@example.org' });
	expect(await response.json()).toMatchObject({ actor: null });
	expect(browser.cookies.has(SESSION_COOKIE)).toBe(false);
	expect(await hub.auth.actor(browser.request('/api/projects'))).toBeNull();
});

test('a sign-in body must be JSON with both fields', async () => {
	const hub = await hubFixture();
	const browser = hub.browser();
	const { csrf } = await hub.challenge(browser);
	const text = await browser.post('/api/auth/google', { csrf }, { 'content-type': 'text/plain' });
	expect(await errorOf(text)).toBe('400 invalid-request');
	expect(await errorOf(await browser.post('/api/auth/google', { csrf }))).toBe(
		'400 invalid-request'
	);
});
