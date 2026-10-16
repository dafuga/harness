import { expect, test, vi } from 'vitest';
import { browserApi } from '../../src/utils/browserApi';

const json = (value: unknown, status = 200) =>
	new Response(JSON.stringify(value), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});

test('a read is a same-origin GET whose query leaves out what is not set', async () => {
	const fetcher = vi.fn(async () => json({ ok: true }));
	const api = browserApi(fetcher as unknown as typeof fetch);
	expect(
		await api.get('/api/projects/p/snapshot', { branch: 'feat/a b', commit: null, path: undefined })
	).toEqual({ ok: true });
	const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
	expect(url).toBe('/api/projects/p/snapshot?branch=feat%2Fa+b');
	expect(init.method).toBe('GET');
	expect(init.credentials).toBe('same-origin');
	expect(JSON.stringify(init.headers)).not.toMatch(/authorization|bearer/i);
});

test('a write sends JSON in the body and never a credential in the address', async () => {
	const fetcher = vi.fn(async () => json({ id: 'i1' }, 201));
	const api = browserApi(fetcher as unknown as typeof fetch);
	await api.send('POST', '/api/auth/google', { credential: 'secret-credential', csrf: 'c' });
	const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
	expect(url).toBe('/api/auth/google');
	expect(init.method).toBe('POST');
	expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
	expect(JSON.parse(String(init.body))).toEqual({ credential: 'secret-credential', csrf: 'c' });
	await api.send('POST', '/api/auth/logout');
	expect(
		JSON.parse(String((fetcher.mock.calls[1] as unknown as [string, RequestInit])[1].body))
	).toEqual({});
});

test('image bytes arrive as a Uint8Array', async () => {
	const fetcher = vi.fn(async () => new Response(new Uint8Array([137, 80, 78, 71])));
	const bytes = await browserApi(fetcher as unknown as typeof fetch).bytes(
		'/api/projects/p/image',
		{
			sha256: 'b'.repeat(64)
		}
	);
	expect(bytes).toBeInstanceOf(Uint8Array);
	expect(Array.from(bytes)).toEqual([137, 80, 78, 71]);
});

test('a coded failure becomes words with its status, and an address outside the API is refused', async () => {
	const fetcher = vi.fn(async () => json({ error: 'session-required' }, 401));
	const api = browserApi(fetcher as unknown as typeof fetch);
	await expect(api.get('/api/projects')).rejects.toMatchObject({
		status: 401,
		code: 'session-required',
		message: 'Sign in to continue.'
	});
	await expect(api.get('https://example.invalid/api/projects')).rejects.toThrow(/API/);
	await expect(api.get('/projects')).rejects.toThrow(/API/);
	expect(fetcher).toHaveBeenCalledTimes(1);
});
