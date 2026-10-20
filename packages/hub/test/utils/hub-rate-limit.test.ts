import { expect, test } from 'vitest';
import { hubRateLimit } from '../../src/routes/api/[...path]/hubRateLimit';
test('unauthenticated challenge requests are bounded and identifiers are hashed', async () => {
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
	const request = new Request('https://fixture.example/api/auth/challenge', { method: 'POST' });
	for (let i = 0; i < 10; i++)
		expect(await hubRateLimit({ request, db, secret: 'test-secret', ip: '192.0.2.1' })).toBeNull();
	const reply = await hubRateLimit({ request, db, secret: 'test-secret', ip: '192.0.2.1' });
	expect(reply?.status).toBe(429);
	expect(reply?.headers.get('Retry-After')).toBe('60');
	expect(keys.every((k) => /^[a-f0-9]{64}$/.test(k))).toBe(true);
	expect(
		await hubRateLimit({
			request: new Request('https://fixture.example/api/auth/status'),
			db,
			secret: 'test-secret'
		})
	).toBeNull();
});
