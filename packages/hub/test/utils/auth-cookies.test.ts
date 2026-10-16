import { expect, test } from 'vitest';
import { SESSION_COOKIE, authCookies, clearCookie, issueCookie } from '../../src/utils/authCookies';

const value = 'a'.repeat(43);
const request = (cookie: string) => new Request('https://hub.test/', { headers: { cookie } });

test('authCookies reads one exact opaque cookie', () => {
	expect(authCookies(request(`other=1; ${SESSION_COOKIE}=${value}`), SESSION_COOKIE)).toBe(value);
	expect(authCookies(request('other=1'), SESSION_COOKIE)).toBeNull();
	expect(authCookies(new Request('https://hub.test/'), SESSION_COOKIE)).toBeNull();
});

test('authCookies treats duplicated, prefixed or malformed values as absent', () => {
	const twice = `${SESSION_COOKIE}=${value}; ${SESSION_COOKIE}=${'b'.repeat(43)}`;
	expect(authCookies(request(twice), SESSION_COOKIE)).toBeNull();
	expect(authCookies(request(`x${SESSION_COOKIE}=${value}`), SESSION_COOKIE)).toBeNull();
	expect(authCookies(request(`${SESSION_COOKIE}=short`), SESSION_COOKIE)).toBeNull();
	expect(authCookies(request(`${SESSION_COOKIE}=${value}%0d%0a`), SESSION_COOKIE)).toBeNull();
});

test('issued cookies are host-only, HttpOnly, Secure and SameSite', () => {
	const cookie = issueCookie(SESSION_COOKIE, value, { maxAge: 60, sameSite: 'Lax' });
	expect(SESSION_COOKIE.startsWith('__Host-')).toBe(true);
	expect(cookie).toBe(
		`${SESSION_COOKIE}=${value}; Path=/; Max-Age=60; HttpOnly; Secure; SameSite=Lax`
	);
	expect(cookie).not.toMatch(/Domain=/i);
	expect(clearCookie(SESSION_COOKIE, 'Lax')).toBe(
		`${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
	);
});
