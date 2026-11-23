import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { authRedirect } from '../../src/lib/verification-evidence/server/auth/github-connection-controller/authHttp';
import {
	sameOrigin,
	bearerToken
} from '../../src/lib/verification-evidence/server/auth/request-session-service/authHttp';
import {
	authHttp,
	authFailure,
	hasAuthorization,
	boundedText,
	readJson,
	authPath
} from '../../src/utils/verification-evidence/authHttp';
import type { AuthHttpOptions } from '../../src/utils/verification-evidence/authHttp.types';

const UNIT = 'hub.function.auth-http';
const API = 'https://hub.example.test';
const SESSION_COOKIE = 'session=abc123; Path=/; HttpOnly; Secure; SameSite=Lax';
const BEARER = 'Bearer abcdefghijklmnopqrstuvwxyz123456';

function meta(symbol: string, state: string) {
	return { unitId: UNIT, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

function jsonRequest(body: string, type = 'application/json'): Request {
	return new Request(`${API}/api/auth/session`, {
		method: 'POST',
		headers: { 'content-type': type },
		body
	});
}

async function summarise(response: Response): Promise<Record<string, unknown>> {
	return {
		status: response.status,
		body: await response.json(),
		contentType: response.headers.get('content-type'),
		cacheControl: response.headers.get('cache-control'),
		nosniff: response.headers.get('x-content-type-options'),
		setCookie: response.headers.getSetCookie()
	};
}

async function errorCode(promise: Promise<unknown>): Promise<string | null> {
	try {
		await promise;
		return null;
	} catch (error) {
		return (error as { code?: string }).code ?? null;
	}
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

test('Same-origin and bearer checks read request headers', () => {
	const origin = 'https://app.example.test';
	const sameRequest = new Request(API, { headers: { origin } });
	const otherRequest = new Request(API, { headers: { origin: 'http://localhost:5173' } });
	const bearerRequest = new Request(API, { headers: { authorization: BEARER } });
	const shortRequest = new Request(API, { headers: { authorization: 'Bearer short' } });
	const bareRequest = new Request(API);
	const results = {
		sameOrigin: sameOrigin(sameRequest, origin),
		otherOrigin: sameOrigin(otherRequest, origin),
		missingOrigin: sameOrigin(bareRequest, origin),
		bearer: bearerToken(bearerRequest),
		shortBearer: bearerToken(shortRequest),
		shortHasAuthorization: hasAuthorization(shortRequest),
		bareHasAuthorization: hasAuthorization(bareRequest)
	};
	expect(results.sameOrigin).toBe(true);
	expect(results.otherOrigin).toBe(false);
	expect(results.missingOrigin).toBe(false);
	expect(results.bearer).toBe('abcdefghijklmnopqrstuvwxyz123456');
	expect(results.shortBearer).toBeNull();
	expect(results.shortHasAuthorization).toBe(true);
	expect(results.bareHasAuthorization).toBe(false);
	recordExampleCases(meta('sameOrigin', 'same-origin-and-bearer-checks-read-request-headers'), [
		{
			name: 'matching origin header is accepted',
			input: { origin, requestOrigin: origin },
			output: results.sameOrigin
		},
		{
			name: 'missing origin header is rejected',
			input: { origin, requestOrigin: null },
			output: results.missingOrigin
		},
		{
			name: 'well-formed bearer token is captured',
			input: { authorization: BEARER },
			output: results.bearer
		},
		{
			name: 'short bearer value is rejected but still present',
			input: { authorization: 'Bearer short' },
			output: { bearerToken: results.shortBearer, hasAuthorization: results.shortHasAuthorization }
		}
	]);
});

test('JSON responses default to 200 and append cookies', async () => {
	const withCookie: AuthHttpOptions = { status: 200, cookies: [SESSION_COOKIE] };
	const plain = await summarise(authHttp({ ok: true }));
	const created = await summarise(authHttp({ id: 'sample-1' }, { status: 201 }));
	const cookied = await summarise(authHttp({ ok: true }, withCookie));
	expect(plain.status).toBe(200);
	expect(created.status).toBe(201);
	expect(plain.cacheControl).toBe('no-store');
	expect(plain.contentType).toBe('application/json; charset=utf-8');
	expect(cookied.setCookie).toEqual([SESSION_COOKIE]);
	recordExampleCases(meta('authHttp', 'json-responses-default-to-200-and-append-cookies'), [
		{ name: 'body with default status', input: { body: { ok: true } }, output: plain },
		{
			name: 'body with explicit 201 status',
			input: { body: { id: 'sample-1' }, status: 201 },
			output: created
		},
		{
			name: 'body with a session cookie',
			input: { body: { ok: true }, ...withCookie },
			output: cookied
		}
	]);
});

test('Failures become a coded JSON response or an opaque 500', async () => {
	const rejected = await readJson(jsonRequest('{}', 'text/plain')).catch((error: unknown) => error);
	const coded = await summarise(authFailure(rejected));
	const opaque = await summarise(authFailure(new Error('GitHub request timed out')));
	expect(coded.body).toEqual({ error: 'invalid-request' });
	expect(coded.status).toBeGreaterThanOrEqual(400);
	expect(coded.status).toBeLessThan(500);
	expect(opaque.status).toBe(500);
	expect(opaque.body).toEqual({ error: 'auth-unavailable' });
	recordExampleCases(
		meta('authFailure', 'failures-become-a-coded-json-response-or-an-opaque-500'),
		[
			{
				name: 'invalid-request AuthFailure keeps its code',
				input: { contentType: 'text/plain' },
				output: coded
			},
			{
				name: 'plain Error becomes auth-unavailable',
				input: { message: 'GitHub request timed out' },
				output: opaque
			}
		]
	);
});

test('readJson accepts JSON objects and rejects other bodies', async () => {
	const accepted = await readJson(jsonRequest('{"redirect":"/dashboard"}'));
	const arrayCode = await errorCode(readJson(jsonRequest('[1,2]')));
	const typeCode = await errorCode(readJson(jsonRequest('{"ok":true}', 'text/plain')));
	const malformedCode = await errorCode(readJson(jsonRequest('{oops')));
	expect(accepted).toEqual({ redirect: '/dashboard' });
	expect(arrayCode).toBe('invalid-request');
	expect(typeCode).toBe('invalid-request');
	expect(malformedCode).toBe('invalid-request');
	recordExampleCases(meta('readJson', 'readjson-accepts-json-objects-and-rejects-other-bodies'), [
		{
			name: 'JSON object body is parsed',
			input: { contentType: 'application/json', body: '{"redirect":"/dashboard"}' },
			output: accepted
		},
		{ name: 'JSON array body is rejected', input: { body: '[1,2]' }, error: { code: arrayCode } },
		{
			name: 'wrong content type is rejected',
			input: { contentType: 'text/plain' },
			error: { code: typeCode }
		},
		{ name: 'malformed JSON is rejected', input: { body: '{oops' }, error: { code: malformedCode } }
	]);
});

test('Bounded text and auth paths reject out-of-range input', async () => {
	const small = await boundedText(new Response('{"ok":true}').body, 1024);
	const oversized = await boundedText(new Response('abcdefgh').body, 4);
	const empty = await boundedText(null, 1024);
	const invalidUtf8 = await boundedText(new Response(new Uint8Array([0xff])).body, 1024);
	const inNamespace = authPath(new Request(`${API}/api/github/installations?page=2`));
	const outside = authPath(new Request(`${API}/dashboard`));
	expect(small).toBe('{"ok":true}');
	expect(oversized).toBeNull();
	expect(empty).toBe('');
	expect(invalidUtf8).toBeNull();
	expect(inNamespace).toBe('/api/github/installations');
	expect(outside).toBeNull();
	recordExampleCases(meta('boundedText', 'bounded-text-and-auth-paths-reject-out-of-range-input'), [
		{
			name: 'body within the byte limit',
			input: { body: '{"ok":true}', limit: 1024 },
			output: small
		},
		{
			name: 'body beyond the byte limit',
			input: { body: 'abcdefgh', limit: 4 },
			output: oversized
		},
		{ name: 'null body reads as empty text', input: { body: null, limit: 1024 }, output: empty },
		{
			name: 'non-UTF-8 bytes are rejected',
			input: { body: '0xff', limit: 1024 },
			output: invalidUtf8
		},
		{
			name: 'auth namespace path drops the query',
			input: { path: '/api/github/installations?page=2' },
			output: inNamespace
		},
		{ name: 'other path is rejected', input: { path: '/dashboard' }, output: outside }
	]);
});
