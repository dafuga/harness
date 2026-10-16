import { afterEach, expect, test, vi } from 'vitest';
import type { AuthStatus, SignInResult } from '../../src/models/HubAuth.types';
import { PROOF_TTL } from '../../src/services/EmailProofService';
import { EMAIL_PROOF_COOKIE, SESSION_COOKIE } from '../../src/utils/authCookies';
import { ORIGIN } from '../support/authFixture';
import { another, emailFixture, linActor } from '../support/emailFixture';
import { LIN } from '../support/googleFixture';
import { nativeRequest } from '../support/hubBrowser';
import { errorOf } from '../support/hubFixture';

afterEach(() => vi.restoreAllMocks());

test('failed delivery keeps an unsent proof and cannot be reported as a sent code', async () => {
	const hub = await emailFixture();
	const { browser } = await hub.pending();
	hub.delivery.failing = true;
	expect(await errorOf(await browser.post('/api/auth/email/start'))).toBe(
		'502 email-delivery-failed'
	);
	const status = (await (await browser.get('/api/auth/status')).json()) as AuthStatus;
	expect(status.emailProof).toMatchObject({ sent: false, expiresAt: null });
	expect(hub.delivery.sent).toHaveLength(0);
	expect(await hub.auth.actor(browser.request('/api/projects'))).toBeNull();
});

test('a Google account outside Gmail and Workspace reaches a pending proof, not a session', async () => {
	const hub = await emailFixture();
	const { browser, response, result } = await hub.pending();
	expect(response.status).toBe(200);
	expect(result).toEqual({
		actor: null,
		emailProof: { email: LIN.email, sent: false, expiresAt: null }
	});
	const cookie = browser.setCookies.find((item) => item.startsWith(EMAIL_PROOF_COOKIE));
	expect(cookie).toMatch(/=[\w-]{43}; Path=\/; Max-Age=600; HttpOnly; Secure; SameSite=Strict$/);
	expect(browser.cookies.has(SESSION_COOKIE)).toBe(false);
	expect(await (await browser.get('/api/auth/status')).json()).toMatchObject({
		actor: null,
		emailProof: { email: LIN.email, sent: false, expiresAt: null }
	});
	expect(hub.store.dump()).not.toContain('"kind"');
	expect(hub.store.dump()).not.toContain(browser.cookies.get(EMAIL_PROOF_COOKIE));
	expect(hub.delivery.sent).toEqual([]);
});

test('a forged, unverified or replayed credential opens no pending proof', async () => {
	const hub = await emailFixture();
	const browser = hub.browser();
	const attempt = async (make: (nonce: string) => Promise<string>) => {
		const { nonce, csrf } = await hub.challenge(browser);
		return errorOf(await browser.post('/api/auth/google', { credential: await make(nonce), csrf }));
	};
	const { google } = hub;
	expect(await attempt((nonce) => google.forge(google.claims(nonce, LIN)))).toBe(
		'401 credential-invalid'
	);
	const unverified = { ...LIN, email_verified: false };
	expect(await attempt((nonce) => google.sign(google.claims(nonce, unverified)))).toBe(
		'401 credential-invalid'
	);
	const stale = await google.sign(google.claims('n'.repeat(43), LIN));
	expect(await attempt(async () => stale)).toBe('401 credential-invalid');
	expect(browser.cookies.has(EMAIL_PROOF_COOKIE)).toBe(false);
	expect(hub.store.count()).toBe(0);
});

test('a pending proof is not an actor, a session, or a way to GitHub or the desktop app', async () => {
	const hub = await emailFixture();
	const { browser } = await hub.pending();
	await hub.code(browser);
	const value = browser.cookies.get(EMAIL_PROOF_COOKIE) ?? '';
	for (const path of ['/api/projects', '/api/projects/p-1/threads', '/api/github/repositories']) {
		expect(await hub.auth.actor(browser.request(path))).toBeNull();
	}
	const post = browser.request('/api/projects', { method: 'POST', headers: { origin: ORIGIN } });
	expect(await hub.auth.actor(post)).toBeNull();
	expect(await errorOf(await browser.get('/api/github/connect'))).toBe('401 session-required');
	expect(await errorOf(await browser.get('/api/github/status'))).toBe('401 session-required');
	const approval = { handoffId: 'h'.repeat(43), userCode: 'ABCD-EFGH' };
	const approve = await browser.post('/api/auth/native/approve', approval);
	expect(await errorOf(approve)).toBe('401 session-required');
	const asSession = { headers: { cookie: `${SESSION_COOKIE}=${value}` } };
	expect(await hub.auth.actor(new Request(`${ORIGIN}/api/projects`, asSession))).toBeNull();
	expect(await hub.auth.actor(nativeRequest('/api/projects', undefined, value))).toBeNull();
});

test('sending the code mails the Google address once and stores nothing readable', async () => {
	const hub = await emailFixture();
	const { browser } = await hub.pending();
	const response = await browser.post('/api/auth/email/start');
	const body = (await response.json()) as SignInResult;
	const expiresAt = new Date(hub.now() + 600_000).toISOString();
	expect(body).toEqual({ actor: null, emailProof: { email: LIN.email, sent: true, expiresAt } });
	const [message] = hub.delivery.sent;
	expect(hub.delivery.sent).toEqual([{ email: LIN.email, code: message.code, expiresAt }]);
	expect(message.code).toMatch(/^[0-9]{8}$/);
	expect(hub.store.dump()).not.toContain(`"${message.code}"`);
	expect(await (await browser.get('/api/auth/status')).json()).toMatchObject({
		actor: null,
		emailProof: { sent: true, expiresAt }
	});
});

test('the right code turns the pending proof into a session for the Google subject', async () => {
	const hub = await emailFixture();
	const { browser } = await hub.pending();
	const response = await hub.verify(browser, await hub.code(browser));
	expect(await response.json()).toEqual({ actor: linActor });
	const session = browser.cookies.get(SESSION_COOKIE) ?? '';
	expect(browser.setCookies).toContain(
		`${SESSION_COOKIE}=${session}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`
	);
	expect(browser.cookies.has(EMAIL_PROOF_COOKIE)).toBe(false);
	expect(await hub.auth.actor(browser.request('/api/projects'))).toEqual(linActor);
	const status = (await (await browser.get('/api/auth/status')).json()) as AuthStatus;
	expect(status).toEqual({ actor: linActor, configured: true, clientId: status.clientId });
});

test('a proven address signs in directly; a new address, another subject or a lapsed proof does not', async () => {
	const hub = await emailFixture();
	const first = await hub.pending();
	await hub.verify(first.browser, await hub.code(first.browser));
	expect((await hub.pending()).result).toEqual({ actor: linActor });
	expect(hub.delivery.sent).toHaveLength(1);
	const moved = await hub.pending({ ...LIN, email: 'lin@elsewhere.example' });
	expect(moved.result).toMatchObject({
		actor: null,
		emailProof: { email: 'lin@elsewhere.example' }
	});
	const other = await hub.pending({ ...LIN, sub: '440000000000000000004' });
	expect(other.result).toMatchObject({ actor: null, emailProof: { email: LIN.email } });
	hub.advance(PROOF_TTL);
	expect((await hub.pending()).result).toMatchObject({ actor: null });
});

test('the proof routes take only the pending cookie, from the same origin, never a bearer', async () => {
	const hub = await emailFixture();
	const { browser } = await hub.pending();
	const body = { code: '12345678' };
	for (const path of ['/api/auth/email/start', '/api/auth/email/verify']) {
		const foreign = await browser.post(path, body, { origin: 'https://evil.example' });
		expect(await errorOf(foreign)).toBe('403 origin-denied');
		expect(await errorOf(await hub.browser().post(path, body))).toBe('401 email-proof-required');
		const bearer = nativeRequest(path, body, browser.cookies.get(EMAIL_PROOF_COOKIE));
		expect(await errorOf((await hub.auth.handle(bearer)) as Response)).toBe(
			'401 email-proof-required'
		);
	}
	expect(hub.delivery.sent).toEqual([]);
	const code = await hub.code(browser);
	const stranger = await hub.pending({ sub: '550000000000000000005', email: 'kim@example.org' });
	const theirs = await hub.code(stranger.browser);
	if (theirs !== code) {
		expect(await errorOf(await hub.verify(stranger.browser, code))).toBe('400 email-code-invalid');
	}
	expect(await (await hub.verify(browser, code)).json()).toEqual({ actor: linActor });
});

test('Gmail and Workspace accounts never see a proof step', async () => {
	const hub = await emailFixture();
	for (const claims of [{}, { email: 'ada@example.org', hd: 'example.org' }]) {
		const browser = hub.browser();
		const result = (await (await hub.signIn(browser, claims)).json()) as SignInResult;
		expect(result.actor?.emailVerified).toBe(true);
		expect('emailProof' in result).toBe(false);
		expect(browser.cookies.has(EMAIL_PROOF_COOKIE)).toBe(false);
	}
	expect(hub.delivery.sent).toEqual([]);
});

test('an invitation code is not a mailbox proof', async () => {
	const hub = await emailFixture();
	const { browser } = await hub.pending();
	const code = await hub.code(browser);
	const invitation = `inv_${'a'.repeat(43)}`;
	expect(await errorOf(await hub.verify(browser, invitation))).toBe('400 invalid-request');
	const accept = {
		method: 'POST',
		headers: { origin: ORIGIN },
		body: JSON.stringify({ code: invitation })
	};
	const route = '/api/projects/p-1/invitations/i-1/accept';
	expect(await hub.auth.actor(browser.request(route, accept))).toBeNull();
	expect(await errorOf(await hub.verify(browser, another(code)))).toBe('400 email-code-invalid');
	expect(await hub.auth.actor(browser.request(route, accept))).toBeNull();
});

test('no address, code or credential reaches a URL, and nothing is logged', async () => {
	const levels = ['log', 'info', 'warn', 'error', 'debug'] as const;
	const spies = levels.map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
	const hub = await emailFixture();
	const { browser } = await hub.pending();
	const code = await hub.code(browser);
	await hub.verify(browser, another(code));
	hub.delivery.failing = true;
	hub.advance(61_000);
	await browser.post('/api/auth/email/start');
	await hub.verify(browser, code);
	for (const url of browser.urls) {
		expect(new URL(url).search).toBe('');
		expect(url).not.toMatch(/example\.org|[0-9]{8}/);
	}
	for (const spy of spies) expect(spy).not.toHaveBeenCalled();
});
