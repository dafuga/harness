import { expect, test } from 'vitest';
import type { NativeAuthorization, NativeStartResult } from '../../src/models/HubAuth.types';
import { randomToken, sha256Url } from '../../src/utils/authSecrets';
import { ORIGIN, ada } from '../support/authFixture';
import type { HubBrowser } from '../support/hubBrowser';
import { nativeRequest } from '../support/hubBrowser';
import { hubFixture } from '../support/hubFixture';
import type { HubFixture } from '../support/hubFixture';
import { project } from '../support/projectionFixture';
import { hostIdentity, outcome, registration, remoteFixture } from '../support/remoteFixture';

const json = { 'content-type': 'application/json' };

/** The desktop handoff, as the app does it: start, approval in the signed-in browser, exchange. */
async function nativeSession(hub: HubFixture, browser: HubBrowser, resource: string) {
	const verifier = randomToken(),
		nonce = randomToken(16);
	const start = { challenge: await sha256Url(verifier), nonce, resource };
	const begun = await hub.auth.handle(nativeRequest('/api/auth/native/start', start));
	const { handoffId, userCode } = (await begun?.json()) as NativeStartResult;
	await browser.post('/api/auth/native/approve', { handoffId, userCode });
	const exchange = { handoffId, verifier, nonce, resource };
	const done = await hub.auth.handle(nativeRequest('/api/auth/native/exchange', exchange));
	return ((await done?.json()) as NativeAuthorization).authorization;
}

async function signedIn() {
	const hub = await hubFixture(),
		browser = hub.browser();
	await hub.signIn(browser);
	return { hub, browser, f: remoteFixture({ auth: hub.auth }), host: await hostIdentity() };
}

test('a browser session registers a host only from the hub origin', async () => {
	const { browser, f, host } = await signedIn(),
		body = JSON.stringify(registration(host));
	const send = (method: string, path: string, origin: string) =>
		f.controller.handle(
			browser.request(path, {
				method,
				body: method === 'POST' ? body : undefined,
				headers: { ...json, origin }
			})
		);
	const path = `/api/remote/hosts/${host.hostId}`;
	for (const origin of ['https://evil.example', `${ORIGIN}.evil.example`, '']) {
		expect(await outcome(await send('POST', '/api/remote/hosts', origin))).toBe(
			'401 session-required'
		);
		expect(await outcome(await send('DELETE', path, origin))).toBe('401 session-required');
	}
	expect(f.relay.calls).toEqual([]);
	expect(await outcome(await send('POST', '/api/remote/hosts', ORIGIN))).toBe('201 ok');
	expect(f.relay.calls.map((call) => call.body.owner)).toEqual([{ id: ada.id }]);
	expect(await outcome(await send('DELETE', path, 'https://evil.example'))).toBe(
		'401 session-required'
	);
	expect(f.relay.hosts.has(host.hostId)).toBe(true);
	expect(await outcome(await send('DELETE', path, ORIGIN))).toBe('200 ok');
});

test('the desktop registers with its native bearer and is the owner it signed in as', async () => {
	const { hub, browser, f, host } = await signedIn();
	const bearer = await nativeSession(hub, browser, 'projects');
	const forged = registration(host, { owner: { id: 'google-someone-else' }, ownerId: 'x' });
	const reply = await f.controller.handle(nativeRequest('/api/remote/hosts', forged, bearer));
	expect(await outcome(reply)).toBe('201 ok');
	expect(f.relay.calls[0].body).toEqual({ owner: { id: ada.id }, ...registration(host) });
	const summary = nativeRequest(`/api/remote/hosts/${host.hostId}`, undefined, bearer);
	expect(await (await f.controller.handle(summary)).json()).toMatchObject({ hostId: host.hostId });
});

test('a wrong bearer or a session scoped to one project does not reach remote hosts', async () => {
	const { hub, browser, f, host } = await signedIn();
	const scoped = await nativeSession(hub, browser, `project:${project.id}`);
	const body = JSON.stringify(registration(host));
	const headers = { ...json, origin: ORIGIN, authorization: `Bearer ${randomToken()}` };
	const wrong = browser.request('/api/remote/hosts', { method: 'POST', body, headers });
	expect(wrong.headers.get('cookie')).toBeTruthy();
	for (const request of [wrong, nativeRequest('/api/remote/hosts', registration(host), scoped)])
		expect(await outcome(await f.controller.handle(request))).toBe('401 session-required');
	expect(f.relay.calls).toEqual([]);
	const whole = await nativeSession(hub, browser, 'projects');
	const accepted = nativeRequest('/api/remote/hosts', registration(host), whole);
	expect(await outcome(await f.controller.handle(accepted))).toBe('201 ok');
});
