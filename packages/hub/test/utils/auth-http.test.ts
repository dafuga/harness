import { expect, test } from 'vitest';
import { AuthFailure } from '../../src/utils/authFail';
import { authFailure, authHttp, readJson } from '../../src/utils/authHttp';
import { authRedirect } from '../../src/controllers/github-connection-controller/authHttp';
import { bearerToken, sameOrigin } from '../../src/services/request-session-service/authHttp';

const post = (body: string, type = 'application/json') =>
	new Request('https://hub.test/api/auth/google', {
		method: 'POST',
		body,
		headers: { 'content-type': type }
	});

test('authHttp never lets a response be cached and appends each cookie', async () => {
	const response = authHttp({ ok: true }, { status: 201, cookies: ['a=1', 'b=2'] });
	expect(response.status).toBe(201);
	expect(response.headers.get('cache-control')).toBe('no-store');
	expect(response.headers.get('x-content-type-options')).toBe('nosniff');
	expect(response.headers.getSetCookie()).toEqual(['a=1', 'b=2']);
	expect(await response.json()).toEqual({ ok: true });
});

test('authFailure exposes only a stable code', async () => {
	const coded = authFailure(new AuthFailure('origin-denied'));
	expect(coded.status).toBe(403);
	expect(await coded.json()).toEqual({ error: 'origin-denied' });
	const unknown = authFailure(new Error('provider said: secret=ghs_synthetic'));
	expect(unknown.status).toBe(500);
	expect(await unknown.text()).toBe('{"error":"auth-unavailable"}');
});

test('authRedirect is a 303 that sends no referrer', () => {
	const response = authRedirect('https://hub.test/?github=connected');
	expect(response.status).toBe(303);
	expect(response.headers.get('location')).toBe('https://hub.test/?github=connected');
	expect(response.headers.get('referrer-policy')).toBe('no-referrer');
	expect(response.headers.get('cache-control')).toBe('no-store');
});

test('sameOrigin needs the exact configured origin', () => {
	const from = (origin?: string) =>
		new Request('https://hub.test/', { method: 'POST', headers: origin ? { origin } : {} });
	expect(sameOrigin(from('https://hub.test'), 'https://hub.test')).toBe(true);
	expect(sameOrigin(from('https://hub.test.evil.example'), 'https://hub.test')).toBe(false);
	expect(sameOrigin(from('null'), 'https://hub.test')).toBe(false);
	expect(sameOrigin(from(), 'https://hub.test')).toBe(false);
});

test('bearerToken accepts one opaque value only from the Authorization header', () => {
	const token = 'b'.repeat(43);
	const from = (authorization: string) =>
		new Request(`https://hub.test/?token=${token}`, { headers: { authorization } });
	expect(bearerToken(from(`Bearer ${token}`))).toBe(token);
	expect(bearerToken(from(`Basic ${token}`))).toBeNull();
	expect(bearerToken(from('Bearer short'))).toBeNull();
	expect(bearerToken(new Request(`https://hub.test/?token=${token}`))).toBeNull();
});

test('readJson accepts a bounded JSON object and nothing else', async () => {
	expect(await readJson(post('{"csrf":"x"}'))).toEqual({ csrf: 'x' });
	await expect(readJson(post('{"csrf":"x"}', 'text/plain'))).rejects.toThrow(AuthFailure);
	await expect(readJson(post('[1]'))).rejects.toThrow(AuthFailure);
	await expect(readJson(post('{'))).rejects.toThrow(AuthFailure);
	await expect(readJson(post(JSON.stringify({ pad: 'x'.repeat(20000) })))).rejects.toThrow(
		AuthFailure
	);
});

function streamed(stream: ReadableStream<Uint8Array>): Request {
	const init = { method: 'POST', body: stream, duplex: 'half' };
	const headers = { 'content-type': 'application/json' };
	return new Request('https://hub.test/api/auth/google', { ...init, headers } as RequestInit);
}

test('readJson stops reading a streamed body at the cap and cancels the rest', async () => {
	const chunk = new Uint8Array(4096).fill(0x61);
	const counts = { pulled: 0, cancelled: 0 };
	const source = {
		pull(controller: ReadableStreamDefaultController<Uint8Array>) {
			counts.pulled += 1;
			if (counts.pulled > 512) controller.close();
			else controller.enqueue(chunk);
		},
		cancel() {
			counts.cancelled += 1;
		}
	};
	const body = new ReadableStream<Uint8Array>(source, { highWaterMark: 0 });
	await expect(readJson(streamed(body))).rejects.toThrow('Hub auth invalid-request');
	expect(counts.cancelled).toBe(1);
	expect(counts.pulled * chunk.byteLength).toBeLessThanOrEqual(16384 + 2 * chunk.byteLength);
});

test('readJson reads a small body that arrives in pieces', async () => {
	const pieces = ['{"cs', 'rf":"', 'x"}'].map((piece) => new TextEncoder().encode(piece));
	const body = new ReadableStream<Uint8Array>({
		pull(controller) {
			const next = pieces.shift();
			if (next) controller.enqueue(next);
			else controller.close();
		}
	});
	expect(await readJson(streamed(body))).toEqual({ csrf: 'x' });
});

test('readJson answers invalid UTF-8 and a failing stream with the same opaque error', async () => {
	const bytes = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(new Uint8Array([0x7b, 0x22, 0xff, 0x22, 0x3a, 0x31, 0x7d]));
			controller.close();
		}
	});
	await expect(readJson(streamed(bytes))).rejects.toThrow('Hub auth invalid-request');
	const broken = new ReadableStream<Uint8Array>({
		pull(controller) {
			controller.error(new Error('socket reset while reading credential=synthetic'));
		}
	});
	await expect(readJson(streamed(broken))).rejects.toThrow('Hub auth invalid-request');
});
