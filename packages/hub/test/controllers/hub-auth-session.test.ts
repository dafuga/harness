import { expect, test } from 'vitest';
import { SESSION_COOKIE } from '../../src/utils/authCookies';
import { randomToken, sha256Url } from '../../src/utils/authSecrets';
import type {
	AccountDevice,
	NativeAuthorization,
	NativeStartResult
} from '../../src/models/accounts-access/HubAuth.types';
import { ORIGIN, ada } from '../support/authFixture';
import { errorOf, hubFixture, type HubFixture } from '../support/hubFixture';
import type { HubBrowser } from '../support/hubBrowser';

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

async function googleNativeAuthorization(hub: HubFixture, browser: HubBrowser) {
	const start = '/api/auth/native/start';
	const finish = '/api/auth/native/return';
	const exchange = '/api/auth/native/exchange';
	const verifier = randomToken();
	const proof = { nonce: randomToken(), resource: 'projects' };
	const response = await browser.post(start, {
		...proof,
		challenge: await sha256Url(verifier),
		callback: 49231,
		deviceName: 'Office Mac'
	});
	const flow = (await response.json()) as NativeStartResult;
	expect(flow.verificationUrl).toBe(`${ORIGIN}/native/${flow.handoffId}?return=1`);
	expect(flow.userCode).toBe('');
	expect(await errorOf(await browser.post(finish, { handoffId: flow.handoffId }))).toBe(
		'401 session-required'
	);
	await hub.signIn(browser);
	const input = { ...proof, verifier, handoffId: flow.handoffId };
	const result = await browser.post(finish, { handoffId: flow.handoffId });
	const callback = new URL(((await result.json()) as { callbackUrl: string }).callbackUrl);
	expect(callback.origin + callback.pathname).toBe('http://127.0.0.1:49231/harness-account');
	expect(callback.searchParams.get('state')).toBe(flow.handoffId);
	const callbackCode = callback.searchParams.get('code');
	expect(callbackCode).toMatch(/^[A-Za-z0-9_-]{43}$/);
	expect(await errorOf(await browser.post(exchange, input))).toBe('400 handoff-invalid');
	const redeemed = await browser.post(exchange, { ...input, callbackCode });
	const { authorization, actor } = (await redeemed.json()) as NativeAuthorization;
	expect(actor).toEqual(ada);
	expect(callback.href).not.toContain(authorization);
	expect(await errorOf(await browser.post(exchange, { ...input, callbackCode }))).toBe(
		'400 handoff-invalid'
	);
	return authorization;
}

test('Google sign-in lists the current browser and native device with account-scoped removal', async () => {
	const hub = await hubFixture();
	const browser = hub.browser();
	const other = hub.browser();
	const devices = '/api/auth/native/devices';
	const account = '/api/account/devices';
	const authorization = await googleNativeAuthorization(hub, browser);
	await hub.signIn(other, { sub: 'another-google-subject' });
	const bearer = { authorization: `Bearer ${authorization}` };
	hub.advance(10 * 60 * 1000);
	await browser.get('/api/auth/status', bearer);
	const list = ((await (await browser.get(devices)).json()) as { devices: AccountDevice[] })
		.devices;
	expect(list).toEqual([
		{ id: expect.any(String), name: 'Office Mac', lastSeenAt: new Date(hub.now()).toISOString() }
	]);
	expect(await (await other.get(devices)).json()).toEqual({ devices: [] });
	expect(await errorOf(await other.post(devices, { id: list[0].id }))).toBe('404 not-found');
	const accountResponse = await browser.get(account);
	expect(accountResponse.status).toBe(200);
	const inventory = (await accountResponse.json()) as {
		devices: AccountDevice[];
		currentDeviceId: string;
	};
	expect(inventory.devices).toEqual([
		{
			id: inventory.currentDeviceId,
			name: 'Web browser',
			lastSeenAt: new Date(hub.now()).toISOString()
		},
		list[0]
	]);
	const browserDevice = { id: inventory.currentDeviceId };
	expect(await errorOf(await hub.browser().get(account))).toBe('401 session-required');
	expect(await errorOf(await browser.get(account, bearer))).toBe('401 session-required');
	expect(await errorOf(await other.post(account, browserDevice))).toBe('404 not-found');
	expect(await errorOf(await other.post(devices, browserDevice))).toBe('404 not-found');
	expect(
		await errorOf(await browser.post(account, browserDevice, { origin: 'https://evil.example' }))
	).toBe('403 origin-denied');
	expect(await hub.auth.actor(browser.request('/api/projects', { headers: bearer }))).toEqual(ada);
	expect(await errorOf(await browser.get(devices, bearer))).toBe('401 session-required');
	expect((await browser.post(devices, { id: list[0].id })).status).toBe(200);
	expect(await hub.auth.actor(browser.request('/api/projects', { headers: bearer }))).toBeNull();
	const secondBrowser = hub.browser();
	await hub.signIn(secondBrowser);
	expect(await errorOf(await secondBrowser.post(devices, browserDevice))).toBe('404 not-found');
	expect((await secondBrowser.post(account, browserDevice)).status).toBe(200);
	expect(await errorOf(await browser.get(account))).toBe('401 session-required');
	expect(await hub.auth.actor(secondBrowser.request('/api/projects'))).toEqual(ada);
});
