import { expect, test, vi } from 'vitest';
import { browserApi } from '../../src/routes/-layout/browserApi';

test('a coded refusal is told to the page before it is thrown, and a success is not', async () => {
	const answers = [
		new Response(JSON.stringify({ error: 'session-required' }), { status: 401 }),
		new Response(JSON.stringify([]), { status: 200 })
	];
	const fetcher = vi.fn(async () => answers.shift()!);
	const failed = vi.fn();
	const api = browserApi(fetcher as unknown as typeof fetch, failed);
	await expect(api.get('/api/projects')).rejects.toMatchObject({ status: 401 });
	expect(failed).toHaveBeenCalledTimes(1);
	expect(failed.mock.calls[0][0]).toMatchObject({ status: 401, code: 'session-required' });
	expect(await api.get('/api/projects')).toEqual([]);
	expect(failed).toHaveBeenCalledTimes(1);
});
