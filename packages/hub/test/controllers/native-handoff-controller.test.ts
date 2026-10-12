import { expect, test } from 'vitest';
import type { NativeAuthorization, NativeStartResult } from '../../src/models/HubAuth.types';
import { randomToken, sha256Url } from '../../src/utils/authSecrets';
import { ORIGIN, ada } from '../support/authFixture';
import type { HubBrowser } from '../support/hubBrowser';
import { nativeRequest } from '../support/hubBrowser';
import { errorOf, hubFixture } from '../support/hubFixture';
import type { HubFixture } from '../support/hubFixture';

const seen: string[] = [];

async function native(hub: HubFixture, path: string, body?: unknown, bearer?: string) {
	const request = nativeRequest(path, body, bearer);
	seen.push(request.url);
	return (await hub.auth.handle(request)) as Response;
}

/** The desktop side of a handoff: it alone knows the verifier and the nonce. */
async function start(hub: HubFixture, resource = 'projects') {
	const verifier = randomToken();
	const nonce = randomToken(16);
	const body = { challenge: await sha256Url(verifier), nonce, resource };
	const response = await native(hub, '/api/auth/native/start', body);
	const started = (await response.json()) as NativeStartResult;
	return { started, exchange: { handoffId: started.handoffId, verifier, nonce, resource } };
}

async function approved(hub: HubFixture, resource = 'projects') {
	const browser = hub.browser();
	await hub.signIn(browser);
	const handoff = await start(hub, resource);
	const { handoffId, userCode } = handoff.started;
	const response = await browser.post('/api/auth/native/approve', { handoffId, userCode });
	return { ...handoff, browser, response };
}

async function exchanged(hub: HubFixture, resource = 'projects') {
	const flow = await approved(hub, resource);
	const response = await native(hub, '/api/auth/native/exchange', flow.exchange);
	return { ...flow, session: (await response.json()) as NativeAuthorization };
}

const actorAt = (hub: HubFixture, path: string, bearer: string) =>
	hub.auth.actor(nativeRequest(path, undefined, bearer));

test('the desktop app gets a bearer session only after the signed-in user types its code', async () => {
	const hub = await hubFixture();
	const { started, exchange, response } = await approved(hub);
	expect(await response.json()).toEqual({ approved: true, resource: 'projects' });
	const poll = await native(hub, '/api/auth/native/poll', { handoffId: started.handoffId });
	expect(await poll.json()).toEqual({ status: 'approved', resource: 'projects' });
	const exchanged = await native(hub, '/api/auth/native/exchange', exchange);
	const session = (await exchanged.json()) as NativeAuthorization;
	expect(session).toMatchObject({ actor: ada, audience: 'harness-desktop', nonce: exchange.nonce });
	const status = await native(hub, '/api/auth/status', undefined, session.authorization);
	expect(await status.json()).toMatchObject({ actor: ada });
	expect(await actorAt(hub, '/api/projects', session.authorization)).toEqual(ada);
});

test('no credential travels in a URL, a redirect or anything but the exchange body', async () => {
	const hub = await hubFixture();
	seen.length = 0;
	const { started, browser, session, exchange } = await exchanged(hub);
	const secrets = [session.authorization, exchange.verifier, exchange.nonce];
	for (const url of [...seen, ...browser.urls, started.verificationUrl]) {
		expect(new URL(url).search).toBe('');
		for (const secret of secrets) expect(url).not.toContain(secret);
	}
	expect(started.verificationUrl).toBe(`${ORIGIN}/native/${started.handoffId}`);
	expect(session.authorization.split('.')).toHaveLength(1);
	const viaQuery = new Request(`${ORIGIN}/api/projects?authorization=${session.authorization}`);
	expect(await hub.auth.actor(viaQuery)).toBeNull();
	const get = await hub.auth.handle(new Request(`${ORIGIN}/api/auth/native/exchange`));
	expect(await errorOf(get as Response)).toBe('405 method-not-allowed');
});

test('approval takes the browser session of a person, same origin, and the right code', async () => {
	const hub = await hubFixture();
	const { started } = await start(hub);
	const body = { handoffId: started.handoffId, userCode: started.userCode };
	const anonymous = await hub.browser().post('/api/auth/native/approve', body);
	expect(await errorOf(anonymous)).toBe('401 session-required');
	const browser = hub.browser();
	await hub.signIn(browser);
	const foreign = await browser.post('/api/auth/native/approve', body, {
		origin: 'https://evil.example'
	});
	expect(await errorOf(foreign)).toBe('403 origin-denied');
	const wrong = await browser.post('/api/auth/native/approve', { ...body, userCode: 'AAAA-AAAA' });
	expect(await errorOf(wrong)).toBe('400 handoff-invalid');
	const other = await exchanged(hub);
	const chained = await native(hub, '/api/auth/native/approve', body, other.session.authorization);
	expect(await errorOf(chained)).toBe('401 session-required');
	expect((await browser.post('/api/auth/native/approve', body)).status).toBe(200);
});

test('an exchange is refused on replay, with a wrong verifier, and before approval', async () => {
	const hub = await hubFixture();
	const pending = await start(hub);
	const early = await native(hub, '/api/auth/native/exchange', pending.exchange);
	expect(await errorOf(early)).toBe('400 handoff-invalid');
	const { exchange } = await exchanged(hub);
	const replay = await native(hub, '/api/auth/native/exchange', exchange);
	expect(await errorOf(replay)).toBe('400 handoff-invalid');
	const guessed = await approved(hub);
	const guess = { ...guessed.exchange, verifier: randomToken() };
	expect(await errorOf(await native(hub, '/api/auth/native/exchange', guess))).toBe(
		'400 handoff-invalid'
	);
	const after = await native(hub, '/api/auth/native/exchange', guessed.exchange);
	expect(await errorOf(after)).toBe('400 handoff-invalid');
});

test('signing out in the browser revokes the desktop sessions it approved', async () => {
	const hub = await hubFixture();
	const { browser, session } = await exchanged(hub);
	expect(await actorAt(hub, '/api/projects', session.authorization)).toEqual(ada);
	await browser.post('/api/auth/logout');
	expect(await actorAt(hub, '/api/projects', session.authorization)).toBeNull();
	const status = await native(hub, '/api/auth/status', undefined, session.authorization);
	expect(await status.json()).toMatchObject({ actor: null });
});

test('the desktop app can sign itself out without ending the browser session', async () => {
	const hub = await hubFixture();
	const { browser, session } = await exchanged(hub);
	const logout = await native(hub, '/api/auth/logout', {}, session.authorization);
	expect(logout.headers.getSetCookie()).toEqual([]);
	expect(await actorAt(hub, '/api/projects', session.authorization)).toBeNull();
	expect(await hub.auth.actor(browser.request('/api/projects'))).toEqual(ada);
});

test('a project-bound desktop session is an actor only inside that project', async () => {
	const hub = await hubFixture();
	const { session } = await exchanged(hub, 'project:p-1');
	const at = (path: string) => actorAt(hub, path, session.authorization);
	expect(session.resource).toBe('project:p-1');
	expect(await at('/api/projects/p-1/threads')).toEqual(ada);
	expect(await at('/api/projects/p-2/threads')).toBeNull();
	expect(await at('/api/projects')).toBeNull();
});

test('a handoff body is validated before any state is created', async () => {
	const hub = await hubFixture();
	const bad = { challenge: 'short', nonce: randomToken(16), resource: 'projects' };
	expect(await errorOf(await native(hub, '/api/auth/native/start', bad))).toBe(
		'400 invalid-request'
	);
	expect(hub.store.count()).toBe(0);
});

test('a browser cannot read the approver out of a handoff it only knows the id of', async () => {
	const hub = await hubFixture();
	const { started } = await approved(hub);
	const poll = await native(hub, '/api/auth/native/poll', { handoffId: started.handoffId });
	expect(Object.keys(await poll.json()).sort()).toEqual(['resource', 'status']);
	const outsider: HubBrowser = hub.browser();
	const peek = await outsider.post('/api/auth/native/poll', { handoffId: started.handoffId });
	expect(await peek.text()).not.toContain(ada.email);
});
