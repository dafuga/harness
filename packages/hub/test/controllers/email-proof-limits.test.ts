import { expect, test } from 'vitest';
import type { SignInResult } from '../../src/models/HubAuth.types';
import { SESSION_COOKIE } from '../../src/utils/authCookies';
import { another, emailFixture, linActor, withProof } from '../support/emailFixture';
import type { EmailFixture } from '../support/emailFixture';
import { LIN } from '../support/googleFixture';
import type { HubBrowser } from '../support/hubBrowser';
import { errorOf } from '../support/hubFixture';

const MINUTE = 61_000;
const wrongCode = '400 email-code-invalid';
const noProof = '401 email-proof-required';
const handled = async (hub: EmailFixture, request: Request) =>
	(await hub.auth.handle(request)) as Response;
const sessions = (hub: EmailFixture) => hub.store.dump().match(/"kind":"browser"/g) ?? [];

/** Asks for a code after waiting out the one-a-minute rule. */
async function nextCode(hub: EmailFixture, browser: HubBrowser): Promise<string> {
	hub.advance(MINUTE);
	return hub.code(browser);
}

test('a wrong code spends an attempt, and the fifth attempt may still be the right one', async () => {
	const hub = await emailFixture();
	const { browser } = await hub.pending();
	const code = await hub.code(browser);
	for (let attempt = 0; attempt < 4; attempt++) {
		expect(await errorOf(await hub.verify(browser, another(code)))).toBe(wrongCode);
	}
	expect(await (await hub.verify(browser, code)).json()).toEqual({ actor: linActor });
});

test('five wrong codes lock the code for good; only a new code works', async () => {
	const hub = await emailFixture();
	const { browser } = await hub.pending();
	const code = await hub.code(browser);
	for (let attempt = 0; attempt < 5; attempt++) await hub.verify(browser, another(code));
	expect(await errorOf(await hub.verify(browser, code))).toBe(wrongCode);
	expect(browser.cookies.has(SESSION_COOKIE)).toBe(false);
	const fresh = await nextCode(hub, browser);
	expect(await (await hub.verify(browser, fresh)).json()).toEqual({ actor: linActor });
});

test('parallel guesses cannot outrun the attempt limit', async () => {
	const hub = await emailFixture();
	const { browser } = await hub.pending();
	const code = await hub.code(browser);
	const guesses = Array.from({ length: 12 }, () =>
		handled(hub, withProof(browser, '/api/auth/email/verify', { code: another(code) }))
	);
	await Promise.all(guesses);
	expect(await errorOf(await hub.verify(browser, code))).toBe(wrongCode);
	expect(sessions(hub)).toHaveLength(0);
});

test('a code and its pending proof end after ten minutes', async () => {
	const hub = await emailFixture();
	const sent = await hub.pending();
	const code = await hub.code(sent.browser);
	hub.advance(600_000);
	expect(await errorOf(await hub.verify(sent.browser, code))).toBe(noProof);
	const status = (await (await sent.browser.get('/api/auth/status')).json()) as SignInResult;
	expect('emailProof' in status).toBe(false);
	const idle = await hub.pending({ ...LIN, sub: '660000000000000000006' });
	hub.advance(600_000);
	expect(await errorOf(await idle.browser.post('/api/auth/email/start'))).toBe(noProof);
});

test('a code works once, also when it is presented several times at once', async () => {
	const hub = await emailFixture();
	const { browser } = await hub.pending();
	const code = await hub.code(browser);
	const attempts = [1, 2, 3, 4].map(() =>
		handled(hub, withProof(browser, '/api/auth/email/verify', { code }))
	);
	const statuses = (await Promise.all(attempts)).map((response) => response.status).sort();
	expect(statuses).toEqual([200, 401, 401, 401]);
	expect(sessions(hub)).toHaveLength(1);
	const replay = await handled(hub, withProof(browser, '/api/auth/email/verify', { code }));
	expect(await errorOf(replay)).toBe(noProof);
	expect(sessions(hub)).toHaveLength(1);
});

test('a newer code invalidates the older one', async () => {
	const hub = await emailFixture();
	const { browser } = await hub.pending();
	const older = await hub.code(browser);
	const newer = await nextCode(hub, browser);
	expect(hub.delivery.sent).toHaveLength(2);
	if (older !== newer) expect(await errorOf(await hub.verify(browser, older))).toBe(wrongCode);
	expect(await (await hub.verify(browser, newer)).json()).toEqual({ actor: linActor });
});

test('one code a minute and five a day, per account and per address across accounts', async () => {
	const hub = await emailFixture();
	const { browser } = await hub.pending();
	expect(await hub.code(browser)).toMatch(/^[0-9]{8}$/);
	expect(await errorOf(await browser.post('/api/auth/email/start'))).toBe('429 email-rate-limited');
	for (let send = 0; send < 4; send++) await nextCode(hub, browser);
	expect(hub.delivery.sent).toHaveLength(5);
	hub.advance(MINUTE);
	expect(await errorOf(await browser.post('/api/auth/email/start'))).toBe('429 email-rate-limited');
	const sameAddress = await hub.pending({ ...LIN, sub: '770000000000000000007' });
	expect(await errorOf(await sameAddress.browser.post('/api/auth/email/start'))).toBe(
		'429 email-rate-limited'
	);
	const elsewhere = await hub.pending({ sub: '880000000000000000008', email: 'kim@example.org' });
	expect(await hub.code(elsewhere.browser)).toMatch(/^[0-9]{8}$/);
	expect(hub.delivery.sent).toHaveLength(6);
	hub.advance(86_400_000);
	const tomorrow = await hub.pending();
	expect(await hub.code(tomorrow.browser)).toMatch(/^[0-9]{8}$/);
});

test('simultaneous requests for a code send one message', async () => {
	const hub = await emailFixture();
	const { browser } = await hub.pending();
	const starts = [1, 2, 3, 4].map(() => handled(hub, withProof(browser, '/api/auth/email/start')));
	const statuses = (await Promise.all(starts)).map((response) => response.status).sort();
	expect(statuses).toEqual([200, 429, 429, 429]);
	expect(hub.delivery.sent).toHaveLength(1);
	const [message] = hub.delivery.sent;
	expect(await (await hub.verify(browser, message.code)).json()).toEqual({ actor: linActor });
});

test('logging out of a pending proof ends it', async () => {
	const hub = await emailFixture();
	const { browser } = await hub.pending();
	const code = await hub.code(browser);
	const replay = withProof(browser, '/api/auth/email/verify', { code });
	expect(await (await browser.post('/api/auth/logout')).json()).toEqual({ ok: true });
	expect(browser.setCookies.some((item) => /email_proof=; .*Max-Age=0/.test(item))).toBe(true);
	expect(await errorOf(await handled(hub, replay))).toBe(noProof);
	expect(sessions(hub)).toHaveLength(0);
});

test('a logout that lands while a verification is in flight leaves no usable session', async () => {
	const hub = await emailFixture();
	const { browser } = await hub.pending();
	const code = await hub.code(browser);
	const logout = withProof(browser, '/api/auth/logout');
	const create = hub.store.sessions.create;
	hub.store.sessions.create = async (record) => {
		await hub.auth.handle(logout);
		await create(record);
	};
	const response = await hub.verify(browser, code);
	expect(await errorOf(response)).toBe(noProof);
	expect(browser.cookies.has(SESSION_COOKIE)).toBe(false);
	expect(hub.store.dump()).not.toMatch(/"kind":"browser"[^}]*"revokedAt":null/);
});

test('a logout with the proof cookie after the verification revokes what it produced', async () => {
	const hub = await emailFixture();
	const { browser } = await hub.pending();
	const code = await hub.code(browser);
	const logout = withProof(browser, '/api/auth/logout');
	expect((await hub.verify(browser, code)).status).toBe(200);
	expect(await hub.auth.actor(browser.request('/api/projects'))).toEqual(linActor);
	await hub.auth.handle(logout);
	expect(await hub.auth.actor(browser.request('/api/projects'))).toBeNull();
});

test('without a delivery the proof cannot start, and nothing pretends it did', async () => {
	const hub = await emailFixture({ delivery: false });
	const { browser, result } = await hub.pending();
	expect(result).toMatchObject({ actor: null, emailProof: { sent: false } });
	const start = await browser.post('/api/auth/email/start');
	expect(await errorOf(start)).toBe('503 email-delivery-disabled');
	expect(await (await browser.get('/api/auth/status')).json()).toMatchObject({
		emailProof: { sent: false, expiresAt: null }
	});
	expect(await errorOf(await hub.verify(browser, '12345678'))).toBe(wrongCode);
});

test('a failed delivery is reported without provider detail and leaves nothing to guess', async () => {
	const hub = await emailFixture();
	const { browser } = await hub.pending();
	hub.delivery.failing = true;
	const failed = await browser.post('/api/auth/email/start');
	expect(failed.status).toBe(502);
	expect(await failed.text()).toBe('{"error":"email-delivery-failed"}');
	expect(hub.delivery.sent).toEqual([]);
	hub.delivery.failing = false;
	expect(await errorOf(await browser.post('/api/auth/email/start'))).toBe('429 email-rate-limited');
	const code = await nextCode(hub, browser);
	expect(await (await hub.verify(browser, code)).json()).toEqual({ actor: linActor });
});
