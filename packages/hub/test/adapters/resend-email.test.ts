import type { Seen } from './resend-email.test.types';
import { expect, test } from 'vitest';
import { ResendEmailAdapter, createResendDelivery } from '../../src/adapters/ResendEmailAdapter';
import { failure } from '../support/githubFixture';
const message = {
	email: 'lin@example.org',
	code: '31415926',
	expiresAt: '2026-10-12T09:10:00.000Z'
};
const failed = 'Hub auth email-delivery-failed';
const config = { apiKey: 're_synthetic_key', from: 'Harness <login@mail.example>' };

function adapter(respond: () => Response | Promise<Response>) {
	const seen: Seen[] = [];
	const fetcher: typeof fetch = async (input, init = {}) => {
		seen.push({ url: String(input), init });
		return respond();
	};
	return { mail: new ResendEmailAdapter({ ...config, fetch: fetcher }), seen };
}

test('ResendEmailAdapter posts from, to, subject and text to the fixed endpoint', async () => {
	const { mail, seen } = adapter(() => Response.json({ id: '49a3999c-synthetic' }));
	await mail.send(message);
	const [{ url, init }] = seen;
	const headers = new Headers(init.headers);
	const body = JSON.parse(String(init.body)) as Record<string, unknown>;
	expect(url).toBe('https://api.resend.com/emails');
	expect(init.method).toBe('POST');
	expect(init.redirect).toBe('manual');
	expect(headers.get('authorization')).toBe('Bearer re_synthetic_key');
	expect(headers.get('content-type')).toBe('application/json');
	expect(Object.keys(body).sort()).toEqual(['from', 'subject', 'text', 'to']);
	expect(body).toMatchObject({ from: config.from, to: ['lin@example.org'] });
	expect(body.text).toContain('31415926');
	expect(body.subject).not.toContain('31415926');
	expect(String(body.text)).not.toMatch(/https?:/);
});

test('ResendEmailAdapter never follows a redirect', async () => {
	const moved = adapter(
		() => new Response(null, { status: 307, headers: { location: 'https://evil.example/emails' } })
	);
	expect(await failure(moved.mail.send(message))).toBe(failed);
	expect(moved.seen).toHaveLength(1);
});

test('ResendEmailAdapter reports every provider failure the same way, without its text', async () => {
	const detail = { message: 'API key re_synthetic_key is invalid', name: 'validation_error' };
	for (const status of [400, 401, 403, 422, 429, 500, 503]) {
		const { mail } = adapter(() => Response.json(detail, { status }));
		expect(await failure(mail.send(message))).toBe(failed);
	}
	const offline = adapter(() => Promise.reject(new TypeError('fetch failed: re_synthetic_key')));
	expect(await failure(offline.mail.send(message))).toBe(failed);
});

test('ResendEmailAdapter counts a message as sent only with the provider id', async () => {
	const empty = adapter(() => Response.json({}));
	expect(await failure(empty.mail.send(message))).toBe(failed);
	const garbled = adapter(() => new Response('<html>ok</html>', { status: 200 }));
	expect(await failure(garbled.mail.send(message))).toBe(failed);
});

test('ResendEmailAdapter stops reading an oversized response', async () => {
	const counts = { pulled: 0, cancelled: 0 };
	const chunk = new TextEncoder().encode(' '.repeat(1024));
	const source = {
		pull(controller: ReadableStreamDefaultController<Uint8Array>) {
			counts.pulled += 1;
			if (counts.pulled > 2048) controller.close();
			else controller.enqueue(chunk);
		},
		cancel() {
			counts.cancelled += 1;
		}
	};
	const body = new ReadableStream<Uint8Array>(source, { highWaterMark: 0 });
	const { mail } = adapter(() => new Response(body, { status: 200 }));
	expect(await failure(mail.send(message))).toBe(failed);
	expect(counts.cancelled).toBe(1);
	expect(counts.pulled).toBeLessThanOrEqual(8);
});

test('createResendDelivery exists only with both settings, each in a safe shape', () => {
	const env = { HARNESS_EMAIL_API_KEY: 're_synthetic_key', HARNESS_EMAIL_FROM: config.from };
	expect(createResendDelivery(env)).toBeInstanceOf(ResendEmailAdapter);
	expect(createResendDelivery({ ...env, HARNESS_EMAIL_FROM: 'login@mail.example' })).not.toBeNull();
	expect(createResendDelivery({})).toBeNull();
	expect(createResendDelivery({ ...env, HARNESS_EMAIL_API_KEY: '' })).toBeNull();
	expect(createResendDelivery({ HARNESS_EMAIL_API_KEY: env.HARNESS_EMAIL_API_KEY })).toBeNull();
	expect(createResendDelivery({ ...env, HARNESS_EMAIL_API_KEY: 'key with\nnewline' })).toBeNull();
	expect(createResendDelivery({ ...env, HARNESS_EMAIL_FROM: 'Harness' })).toBeNull();
	expect(
		createResendDelivery({ ...env, HARNESS_EMAIL_FROM: 'a@b.example\r\nBcc: x@y.example' })
	).toBeNull();
});
