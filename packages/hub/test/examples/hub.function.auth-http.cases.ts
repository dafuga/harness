import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { authRedirect } from '../../src/lib/verification-evidence/server/auth/github-connection-controller/authHttp';

const UNIT = 'hub.function.auth-http';
export const SESSION_COOKIE = 'session=abc123; Path=/; HttpOnly; Secure; SameSite=Lax';

export function meta(symbol: string, state: string) {
	return { unitId: UNIT, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

test('Redirect responses are uncached 303 responses with cookies', () => {
	const location = '/api/auth/callback?code=sample';
	const response = authRedirect(location, [SESSION_COOKIE]);
	const summary = {
		status: response.status,
		location: response.headers.get('location'),
		referrerPolicy: response.headers.get('referrer-policy'),
		cacheControl: response.headers.get('cache-control'),
		nosniff: response.headers.get('x-content-type-options'),
		setCookie: response.headers.getSetCookie()
	};
	expect(summary.status).toBe(303);
	expect(summary.location).toBe(location);
	expect(summary.referrerPolicy).toBe('no-referrer');
	expect(summary.cacheControl).toBe('no-store');
	expect(summary.setCookie).toEqual([SESSION_COOKIE]);
	recordExampleCases(
		meta('authRedirect', 'redirect-responses-are-uncached-303-responses-with-cookies'),
		[
			{
				name: 'callback location with one session cookie',
				input: { location, cookies: [SESSION_COOKIE] },
				output: summary
			}
		]
	);
});
