import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	SESSION_COOKIE,
	CHALLENGE_COOKIE,
	EMAIL_PROOF_COOKIE,
	authCookies,
	issueCookie,
	clearCookie
} from '../../src/utils/accounts-access/authCookies';
import type { CookieOptions } from '../../src/utils/accounts-access/authCookies.types';

const opaque = 'K9v2Qm7xN4pR8sT3bH6cL1wF5dZ0aG2e';
const options = { maxAge: 900, sameSite: 'Lax' } satisfies CookieOptions;

test('Reads one valid opaque cookie and rejects invalid matches', () => {
	const valid = authCookies(new Request('https://example.test', {
		headers: { cookie: `other=value; ${SESSION_COOKIE}=${opaque}` }
	}), SESSION_COOKIE);
	const missing = authCookies(new Request('https://example.test'), SESSION_COOKIE);
	const malformed = authCookies(new Request('https://example.test', {
		headers: { cookie: `${SESSION_COOKIE}=short` }
	}), SESSION_COOKIE);
	const duplicate = authCookies(new Request('https://example.test', {
		headers: { cookie: `${SESSION_COOKIE}=${opaque}; ${SESSION_COOKIE}=${opaque}` }
	}), SESSION_COOKIE);
	expect([valid, missing, malformed, duplicate]).toEqual([opaque, null, null, null]);
	recordExampleCases(
		{
			unitId: 'hub.function.auth-cookies',
			symbol: 'authCookies',
			state: 'reads-one-valid-opaque-cookie-and-rejects-invalid-matches',
			evidence: 'examples-cases',
			file: 'reads-one-valid-opaque-cookie-and-rejects-invalid-matches.json'
		},
		[
			{ name: 'one valid selected cookie', input: { cookie: `other=value; ${SESSION_COOKIE}=${opaque}`, name: SESSION_COOKIE }, output: valid },
			{ name: 'missing cookie header', input: { cookie: null, name: SESSION_COOKIE }, output: missing },
			{ name: 'malformed short value', input: { cookie: `${SESSION_COOKIE}=short`, name: SESSION_COOKIE }, output: malformed },
			{ name: 'duplicate selected cookies', input: { cookie: `${SESSION_COOKIE}=${opaque}; ${SESSION_COOKIE}=${opaque}`, name: SESSION_COOKIE }, output: duplicate }
		]
	);
});

test('Issues a secure host-only cookie header', () => {
	const header = issueCookie(SESSION_COOKIE, opaque, options);
	expect(header).toBe(`${SESSION_COOKIE}=${opaque}; Path=/; Max-Age=900; HttpOnly; Secure; SameSite=Lax`);
	expect([SESSION_COOKIE, CHALLENGE_COOKIE, EMAIL_PROOF_COOKIE]).toEqual([
		'__Host-harness_session', '__Host-harness_challenge', '__Host-harness_email_proof'
	]);
	recordExampleCases(
		{
			unitId: 'hub.function.auth-cookies',
			symbol: 'issueCookie',
			state: 'issues-a-secure-host-only-cookie-header',
			evidence: 'examples-cases',
			file: 'issues-a-secure-host-only-cookie-header.json'
		},
		[{ name: 'session cookie with Lax policy', input: { name: SESSION_COOKIE, value: opaque, options }, output: header }]
	);
});

test('Clears a cookie with an empty value and zero lifetime', () => {
	const header = clearCookie(SESSION_COOKIE, 'Strict');
	expect(header).toBe(`${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`);
	recordExampleCases(
		{
			unitId: 'hub.function.auth-cookies',
			symbol: 'clearCookie',
			state: 'clears-a-cookie-with-an-empty-value-and-zero-lifetime',
			evidence: 'examples-cases',
			file: 'clears-a-cookie-with-an-empty-value-and-zero-lifetime.json'
		},
		[{ name: 'expire session cookie with Strict policy', input: { name: SESSION_COOKIE, sameSite: 'Strict' }, output: header }]
	);
});
