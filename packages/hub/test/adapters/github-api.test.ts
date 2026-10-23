import type { Seen } from './github-api.test.types';
import { expect, test } from 'vitest';
import { GithubApiAdapter } from '../../src/adapters/GithubApiAdapter';
import { failure } from '../support/githubFixture';

function adapter(respond: () => Response | Promise<Response>) {
	const seen: Seen[] = [];
	const fetcher: typeof fetch = async (input, init = {}) => {
		seen.push({ url: String(input), init });
		return respond();
	};
	return { api: new GithubApiAdapter({ fetch: fetcher }), seen };
}

test('GithubApiAdapter sends tokens in headers and asks for redirects not to be followed', async () => {
	const { api, seen } = adapter(() => Response.json({ id: 501, login: 'ada-hub' }));
	expect(await api.user('ghu_synthetic')).toEqual({ id: 501, login: 'ada-hub' });
	const [{ url, init }] = seen;
	const headers = new Headers(init.headers);
	expect(url).toBe('https://api.github.com/user');
	expect(init.redirect).toBe('manual');
	expect(headers.get('authorization')).toBe('Bearer ghu_synthetic');
	expect(headers.get('x-github-api-version')).toBe('2022-11-28');
	expect(headers.get('accept')).toBe('application/vnd.github+json');
	expect(headers.get('user-agent')).toBe('harness-hub');
});

test('GithubApiAdapter posts OAuth secrets as a form body to the fixed token endpoint', async () => {
	const { api, seen } = adapter(() =>
		Response.json({ access_token: 'ghu_synthetic', token_type: 'bearer' })
	);
	const token = await api.userToken({ client_secret: 'synthetic-secret', code: 'abc' });
	expect(token).toEqual({
		accessToken: 'ghu_synthetic',
		expiresIn: null,
		refreshToken: null,
		refreshExpiresIn: null
	});
	expect(seen[0].url).toBe('https://github.com/login/oauth/access_token');
	expect(seen[0].init.method).toBe('POST');
	expect(new Headers(seen[0].init.headers).get('accept')).toBe('application/json');
	expect(String(seen[0].init.body)).toBe('client_secret=synthetic-secret&code=abc');
});

test('GithubApiAdapter treats a 200 carrying an OAuth error as no token', async () => {
	const { api } = adapter(() => Response.json({ error: 'bad_verification_code' }));
	expect(await api.userToken({ code: 'abc' })).toBeNull();
});

test('GithubApiAdapter maps a client error to null and never forwards its body', async () => {
	const { api } = adapter(() => Response.json({ message: 'provider detail' }, { status: 404 }));
	expect(await api.user('ghu_synthetic')).toBeNull();
	expect(
		await api.repository('ghu_synthetic', { owner: 'synthetic-org', name: 'source' })
	).toBeNull();
});

test('GithubApiAdapter reports outages, rate limits and bad payloads as unavailable', async () => {
	const unavailable = 'Hub auth github-unavailable';
	const down = adapter(() => Response.json({ message: 'provider detail' }, { status: 502 }));
	expect(await failure(down.api.user('ghu_synthetic'))).toBe(unavailable);
	const limited = adapter(
		() => new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0' } })
	);
	expect(await failure(limited.api.user('ghu_synthetic'))).toBe(unavailable);
	const offline = adapter(() => Promise.reject(new TypeError('fetch failed: ghu_synthetic')));
	expect(await failure(offline.api.user('ghu_synthetic'))).toBe(unavailable);
	const garbled = adapter(() => new Response('<html>', { status: 200 }));
	expect(await failure(garbled.api.user('ghu_synthetic'))).toBe(unavailable);
});

test('GithubApiAdapter never follows a redirect and reports it as unavailable', async () => {
	const moved = adapter(
		() => new Response(null, { status: 302, headers: { location: 'https://evil.example/user' } })
	);
	expect(await failure(moved.api.user('ghu_synthetic'))).toBe('Hub auth github-unavailable');
	expect(moved.seen).toHaveLength(1);
	const opaque = adapter(() => Response.redirect('https://evil.example/user', 307));
	expect(await failure(opaque.api.user('ghu_synthetic'))).toBe('Hub auth github-unavailable');
});

test('GithubApiAdapter refuses a path segment that could redirect the request', async () => {
	const { api, seen } = adapter(() => Response.json({}));
	const target = { owner: 'synthetic-org/../..', name: 'source' };
	expect(await api.repository('ghu_synthetic', target)).toBeNull();
	expect(seen).toHaveLength(0);
});
