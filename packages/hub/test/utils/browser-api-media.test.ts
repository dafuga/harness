import { expect, test, vi } from 'vitest';
import { browserApi } from '../../src/routes/-layout/browserApi';

test('recorded bytes arrive with the type the server states for them', async () => {
	const fetcher = vi.fn(
		async () =>
			new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'Content-Type': 'image/png' } })
	);
	const api = browserApi(fetcher as unknown as typeof fetch);
	const found = await api.media('/api/projects/p/artifact', { side: 'after', viewport: null });
	expect(found.mediaType).toBe('image/png');
	expect(Array.from(found.bytes)).toEqual([137, 80, 78, 71]);
	const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
	expect(url).toBe('/api/projects/p/artifact?side=after');
	expect([init.method, init.credentials, init.cache]).toEqual(['GET', 'same-origin', 'no-store']);
});

test('bytes without a stated type have none, and a refusal keeps its code and status', async () => {
	const bare = vi.fn(async () => {
		const response = new Response(new Uint8Array([1]));
		response.headers.delete('Content-Type');
		return response;
	});
	const found = await browserApi(bare as unknown as typeof fetch).media('/api/projects/p/artifact');
	expect(found.mediaType).toBe('');
	const refused = vi.fn(async () =>
		Response.json({ error: 'artifact-too-large' }, { status: 413 })
	);
	await expect(
		browserApi(refused as unknown as typeof fetch).media('/api/projects/p/artifact')
	).rejects.toMatchObject({ status: 413, code: 'artifact-too-large' });
});
