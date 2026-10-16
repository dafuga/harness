import { expect, test } from 'vitest';
import type { GithubRepositories } from '../../src/models/HubAuth.types';
import { ORIGIN, ada } from '../support/authFixture';
import { ADA_GITHUB, GRACE_GITHUB, SOURCE_REPOSITORY } from '../support/githubFakeState';
import { failure } from '../support/githubFixture';
import type { HubBrowser } from '../support/hubBrowser';
import { nativeRequest } from '../support/hubBrowser';
import { errorOf, hubFixture } from '../support/hubFixture';
import type { HubFixture } from '../support/hubFixture';

const graceClaims = { sub: '220000000000000000002', email: 'grace@gmail.com', name: 'Grace' };

async function signedIn(hub: HubFixture, claims = {}): Promise<HubBrowser> {
	const browser = hub.browser();
	await hub.signIn(browser, claims);
	return browser;
}

/** Follows /api/github/connect to GitHub, approves as `githubUser`, returns the callback path. */
async function roundTrip(hub: HubFixture, browser: HubBrowser, githubUser: number) {
	const connect = await browser.get('/api/github/connect');
	const authorize = connect.headers.get('location') ?? '';
	const code = hub.github.approve(githubUser, authorize);
	const state = new URL(authorize).searchParams.get('state');
	return { connect, authorize, callback: `/api/github/callback?code=${code}&state=${state}` };
}

test('connecting sends the signed-in browser to GitHub with state and PKCE only', async () => {
	const hub = await hubFixture();
	const { connect, authorize } = await roundTrip(hub, await signedIn(hub), ADA_GITHUB);
	expect(connect.status).toBe(303);
	expect(connect.headers.get('cache-control')).toBe('no-store');
	expect(connect.headers.get('referrer-policy')).toBe('no-referrer');
	expect(authorize.startsWith('https://github.com/login/oauth/authorize?')).toBe(true);
	expect([...new URL(authorize).searchParams.keys()].sort()).toEqual([
		'client_id',
		'code_challenge',
		'code_challenge_method',
		'redirect_uri',
		'state'
	]);
	expect(authorize).not.toContain(hub.github.state.app.clientSecret);
});

test('connecting needs a browser session and a same-site navigation', async () => {
	const hub = await hubFixture();
	expect(await errorOf(await hub.browser().get('/api/github/connect'))).toBe(
		'401 session-required'
	);
	const browser = await signedIn(hub);
	const crossSite = await browser.get('/api/github/connect', { 'sec-fetch-site': 'cross-site' });
	expect(await errorOf(crossSite)).toBe('403 origin-denied');
	const bearer = nativeRequest('/api/github/connect', undefined, 'x'.repeat(43));
	expect(await errorOf((await hub.auth.handle(bearer)) as Response)).toBe('401 session-required');
	expect(hub.store.count()).toBe(1);
});

test('the callback stores a sealed grant and lands on a fixed page without a credential', async () => {
	const hub = await hubFixture();
	const browser = await signedIn(hub);
	const { callback } = await roundTrip(hub, browser, ADA_GITHUB);
	const done = await browser.get(callback);
	expect(done.status).toBe(303);
	expect(done.headers.get('location')).toBe(`${ORIGIN}/?github=connected`);
	expect(hub.store.dump()).not.toMatch(/gh[ur]_/);
	const status = await browser.get('/api/github/status');
	expect(await status.json()).toEqual({ configured: true, connected: true, login: 'ada-hub' });
	const picker = (await (
		await browser.get('/api/github/repositories')
	).json()) as GithubRepositories;
	expect(picker.repositories.map((item) => item.id)).toEqual([9001, 9002]);
	expect(JSON.stringify(picker)).not.toMatch(/installation/i);
});

test('a callback in another browser, replayed, refused or unsigned connects nothing', async () => {
	const hub = await hubFixture();
	const victim = await signedIn(hub);
	const attacker = await signedIn(hub, graceClaims);
	const stolen = await roundTrip(hub, attacker, GRACE_GITHUB);
	const failed = `${ORIGIN}/?github=failed`;
	expect((await victim.get(stolen.callback)).headers.get('location')).toBe(failed);
	expect((await attacker.get(stolen.callback)).headers.get('location')).toBe(failed);
	const own = await roundTrip(hub, victim, ADA_GITHUB);
	const refused = own.callback.replace(/code=[^&]+/, 'error=access_denied');
	expect((await victim.get(refused)).headers.get('location')).toBe(failed);
	expect((await hub.browser().get(own.callback)).headers.get('location')).toBe(failed);
	for (const browser of [victim, attacker]) {
		expect(await (await browser.get('/api/github/status')).json()).toMatchObject({
			connected: false
		});
	}
});

test('repository proof reaches the project code only through the server-side call', async () => {
	const hub = await hubFixture();
	const browser = await signedIn(hub);
	await browser.get((await roundTrip(hub, browser, ADA_GITHUB)).callback);
	const { authorizeRepository, token } = hub.auth;
	const identity = await authorizeRepository(ada, SOURCE_REPOSITORY);
	expect(identity).toMatchObject({ id: SOURCE_REPOSITORY, installationId: 71 });
	const scope = { installationId: 71, repositoryIds: [SOURCE_REPOSITORY] };
	expect(await token({ ...scope, permissions: { contents: 'read' } })).toMatch(/^ghs_/);
	expect(await failure(token({ ...scope, permissions: { contents: 'write' } }))).toBe(
		'Hub auth token-scope-denied'
	);
	const asked = { installationId: 71, repositoryId: SOURCE_REPOSITORY, repositoryIds: [9001] };
	for (const path of ['/api/github/token', '/api/github/installations', '/api/auth/token']) {
		expect(await errorOf(await browser.post(path, asked))).toBe('404 not-found');
	}
	for (const url of browser.urls) expect(url).not.toMatch(/gh[usr]_/);
});

test('status and the picker need a session, and the picker needs a connection', async () => {
	const hub = await hubFixture();
	expect(await errorOf(await hub.browser().get('/api/github/status'))).toBe('401 session-required');
	const browser = await signedIn(hub);
	expect(await (await browser.get('/api/github/status')).json()).toEqual({
		configured: true,
		connected: false,
		login: null
	});
	expect(await errorOf(await browser.get('/api/github/repositories'))).toBe(
		'403 github-not-connected'
	);
});

test('disconnecting is same-origin and removes the proof', async () => {
	const hub = await hubFixture();
	const browser = await signedIn(hub);
	await browser.get((await roundTrip(hub, browser, ADA_GITHUB)).callback);
	const forged = await browser.post(
		'/api/github/disconnect',
		{},
		{ origin: 'https://evil.example' }
	);
	expect(await errorOf(forged)).toBe('403 origin-denied');
	expect(await hub.auth.authorizeRepository(ada, SOURCE_REPOSITORY)).toMatchObject({ id: 9001 });
	expect(await (await browser.post('/api/github/disconnect')).json()).toEqual({ ok: true });
	expect(await failure(hub.auth.authorizeRepository(ada, SOURCE_REPOSITORY))).toBe(
		'Hub auth github-not-connected'
	);
});

test('a provider outage on the callback is a failed connection, never provider text', async () => {
	const hub = await hubFixture();
	const browser = await signedIn(hub);
	const { callback } = await roundTrip(hub, browser, ADA_GITHUB);
	hub.github.state.outage = true;
	const done = await browser.get(callback);
	expect(done.headers.get('location')).toBe(`${ORIGIN}/?github=failed`);
	expect(await done.text()).toBe('');
});

test('without GitHub app settings the connection is reported as not configured', async () => {
	const hub = await hubFixture({ github: false });
	const browser = await signedIn(hub);
	expect(await (await browser.get('/api/github/status')).json()).toEqual({
		configured: false,
		connected: false,
		login: null
	});
	expect(await errorOf(await browser.get('/api/github/connect'))).toBe('503 github-disabled');
	const disabled = 'Hub auth github-disabled';
	expect(await failure(hub.auth.authorizeRepository(ada, SOURCE_REPOSITORY))).toBe(disabled);
	const scope = { installationId: 71, repositoryIds: [9001], permissions: { contents: 'read' } };
	expect(await failure(hub.auth.token(scope as never))).toBe(disabled);
});
