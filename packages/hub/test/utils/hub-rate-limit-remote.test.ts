import { expect, test } from 'vitest';
import { hubRateLimit } from '../../src/routes/api/[...path]/-server/hubRateLimit';

const hosts = 'https://fixture.example/api/remote/hosts';

function counter() {
	let count = 0;
	const keys: string[] = [];
	const db = {
		prepare: () => ({
			bind: (key: string) => {
				keys.push(key);
				return { first: async () => ({ count: ++count }) };
			}
		})
	} as unknown as D1Database;
	const limit = (url: string, method: string) =>
		hubRateLimit({
			request: new Request(url, { method }),
			db,
			secret: 'test-secret',
			ip: '192.0.2.1'
		});
	return { keys, limit };
}

test('host registration is bounded to ten a minute for one address', async () => {
	const { keys, limit } = counter();
	for (let i = 0; i < 10; i++) expect(await limit(hosts, 'POST')).toBeNull();
	const reply = await limit(hosts, 'POST');
	expect(reply?.status).toBe(429);
	expect(await reply?.json()).toEqual({ error: 'rate-limited' });
	expect(reply?.headers.get('Retry-After')).toBe('60');
	expect(keys).toHaveLength(11);
	expect(new Set(keys).size).toBe(1);
	expect(keys.every((key) => /^[a-f0-9]{64}$/.test(key))).toBe(true);
});

test('reads and removals of a host are not counted', async () => {
	const { keys, limit } = counter(),
		host = `${hosts}/${'a1'.repeat(20)}`;
	expect(await limit(hosts, 'GET')).toBeNull();
	expect(await limit(host, 'GET')).toBeNull();
	expect(await limit(host, 'DELETE')).toBeNull();
	expect(await limit(`${host}/devices/${'d1'.repeat(20)}`, 'DELETE')).toBeNull();
	expect(keys).toEqual([]);
	expect(await limit(hosts, 'POST')).toBeNull();
	expect(keys).toHaveLength(1);
});
