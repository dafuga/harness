import { expect, test } from 'vitest';
import { SESSION_COOKIE } from '../../src/utils/authCookies';
import { ORIGIN, ada } from '../support/authFixture';
import { errorOf, hubFixture } from '../support/hubFixture';

test('logout clears the cookie and invalidates the session on the server', async () => {
	const hub = await hubFixture();
	const browser = hub.browser();
	await hub.signIn(browser);
	const kept = browser.request('/api/projects');
	const response = await browser.post('/api/auth/logout');
	expect(await response.json()).toEqual({ ok: true });
	expect(browser.setCookies.at(-1)).toBe(
		`${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
	);
	expect(await hub.auth.actor(kept)).toBeNull();
	expect(await (await browser.get('/api/auth/status')).json()).toMatchObject({ actor: null });
});

test('another site cannot sign a user out', async () => {
	const hub = await hubFixture();
	const browser = hub.browser();
	await hub.signIn(browser);
	const forged = await browser.post('/api/auth/logout', {}, { origin: 'https://evil.example' });
	expect(await errorOf(forged)).toBe('403 origin-denied');
	expect(await hub.auth.actor(browser.request('/api/projects'))).toEqual(ada);
});

test('logging out one session leaves the other sessions of the same person', async () => {
	const hub = await hubFixture();
	const laptop = hub.browser();
	const phone = hub.browser();
	await hub.signIn(laptop);
	await hub.signIn(phone);
	await laptop.post('/api/auth/logout');
	expect(await hub.auth.actor(phone.request('/api/projects'))).toEqual(ada);
	expect((await hub.browser().post('/api/auth/logout')).status).toBe(200);
});

test('an identifier is not a credential, wherever it is put', async () => {
	const hub = await hubFixture();
	await hub.signIn(hub.browser());
	const guesses = [ada.id, ada.email, 'x'.repeat(43)];
	for (const guess of guesses) {
		const cookie = new Request(`${ORIGIN}/api/projects`, {
			headers: { cookie: `${SESSION_COOKIE}=${guess}` }
		});
		const bearer = new Request(`${ORIGIN}/api/projects`, {
			headers: { authorization: `Bearer ${guess}` }
		});
		const query = new Request(`${ORIGIN}/api/projects?actor=${guess}&session=${guess}`);
		for (const request of [cookie, bearer, query]) expect(await hub.auth.actor(request)).toBeNull();
	}
	const header = new Request(`${ORIGIN}/api/projects`, { headers: { 'x-actor-id': ada.id } });
	expect(await hub.auth.actor(header)).toBeNull();
});

test('actor() gives project handlers CSRF protection on unsafe methods', async () => {
	const hub = await hubFixture();
	const browser = hub.browser();
	await hub.signIn(browser);
	const post = (origin: string) =>
		hub.auth.actor(browser.request('/api/projects', { method: 'POST', headers: { origin } }));
	expect(await post('')).toBeNull();
	expect(await post('https://evil.example')).toBeNull();
	expect(await post(ORIGIN)).toEqual(ada);
});

test('a session expires on the server even if the browser keeps the cookie', async () => {
	const hub = await hubFixture();
	const browser = hub.browser();
	await hub.signIn(browser);
	hub.advance(7 * 24 * 60 * 60 * 1000);
	expect(await hub.auth.actor(browser.request('/api/projects'))).toBeNull();
});

test('handle answers only its own namespaces, with a stable error for the rest of them', async () => {
	const hub = await hubFixture();
	const browser = hub.browser();
	for (const path of ['/', '/api/projects', '/api/authx/status', '/api/github', '/api/auth']) {
		expect(await hub.auth.handle(new Request(`${ORIGIN}${path}`))).toBeNull();
	}
	expect(await errorOf(await browser.get('/api/auth/unknown'))).toBe('404 not-found');
	expect(await errorOf(await browser.get('/api/github/token'))).toBe('404 not-found');
	expect(await errorOf(await browser.get('/api/auth/google'))).toBe('405 method-not-allowed');
	expect(await errorOf(await browser.post('/api/auth/status'))).toBe('405 method-not-allowed');
	expect(await errorOf(await browser.get('/api/auth/__proto__'))).toBe('404 not-found');
});

test('an internal failure is an opaque 500', async () => {
	const hub = await hubFixture();
	const browser = hub.browser();
	hub.store.challenges.create = async () => {
		throw new Error('D1_ERROR: synthetic detail with secret');
	};
	const response = await browser.post('/api/auth/challenge');
	expect(await response.text()).toBe('{"error":"auth-unavailable"}');
	expect(response.status).toBe(500);
});
