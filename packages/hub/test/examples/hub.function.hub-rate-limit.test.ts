import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hubRateLimit } from '../../src/routes/api/[...path]/hubRateLimit';

const NOW = 1_700_000_000_000;
const SECRET = 'example-secret';
const base = { secret: SECRET, ip: '203.0.113.7', now: NOW };

function postTo(path: string, method = 'POST'): Request {
	return new Request(`https://hub.example${path}`, { method });
}

function fakeDb(row: { count: number } | null, calls: unknown[][]): D1Database {
	return {
		prepare: () => ({
			bind: (...args: unknown[]) => {
				calls.push(args);
				return { first: () => Promise.resolve(row) };
			}
		})
	} as unknown as D1Database;
}

function failingDb(): D1Database {
	return {
		prepare: () => {
			throw new Error('d1 unavailable');
		}
	} as unknown as D1Database;
}

async function summarise(res: Response | null) {
	if (res === null) return null;
	const body: unknown = await res.json();
	return { status: res.status, retryAfter: res.headers.get('Retry-After'), body };
}

test('Skips counting for non-POST and unlisted routes', async () => {
	const calls: unknown[][] = [];
	const db = fakeDb({ count: 1 }, calls);
	const getRes = await hubRateLimit({ ...base, db, request: postTo('/api/auth/challenge', 'GET') });
	const otherRes = await hubRateLimit({ ...base, db, request: postTo('/api/other') });
	expect(getRes).toBeNull();
	expect(otherRes).toBeNull();
	expect(calls).toEqual([]);
	recordExampleCases(
		{
			unitId: 'hub.function.hub-rate-limit',
			symbol: 'hubRateLimit',
			state: 'skips-counting-for-non-post-and-unlisted-routes',
			evidence: 'examples-cases',
			file: 'skips-counting-for-non-post-and-unlisted-routes.json'
		},
		[
			{
				name: 'GET to a limited route is not counted',
				input: { method: 'GET', path: '/api/auth/challenge' },
				output: null
			},
			{
				name: 'POST to an unlisted route is not counted',
				input: { method: 'POST', path: '/api/other' },
				output: null
			}
		]
	);
});

test('Allows a count at the route cap', async () => {
	const calls: unknown[][] = [];
	const db = fakeDb({ count: 10 }, calls);
	const res = await hubRateLimit({ ...base, db, request: postTo('/api/auth/challenge') });
	expect(res).toBeNull();
	expect(calls).toHaveLength(1);
	const [id] = calls[0] ?? [];
	expect(id).toMatch(/^[0-9a-f]{64}$/);
	expect(calls[0]?.slice(1)).toEqual([NOW + 60000, NOW, NOW, NOW + 60000]);
	recordExampleCases(
		{
			unitId: 'hub.function.hub-rate-limit',
			symbol: 'hubRateLimit',
			state: 'allows-a-count-at-the-route-cap',
			evidence: 'examples-cases',
			file: 'allows-a-count-at-the-route-cap.json'
		},
		[
			{
				name: 'challenge route with count 10 and cap 10 passes',
				input: { path: '/api/auth/challenge', count: 10, cap: 10, ip: '203.0.113.7' },
				output: null
			}
		]
	);
});

test('Returns 429 with Retry-After over the email start cap', async () => {
	const calls: unknown[][] = [];
	const db = fakeDb({ count: 6 }, calls);
	const res = await hubRateLimit({ ...base, db, request: postTo('/api/auth/email/start') });
	const output = await summarise(res);
	expect(output).toEqual({ status: 429, retryAfter: '60', body: { error: 'rate-limited' } });
	recordExampleCases(
		{
			unitId: 'hub.function.hub-rate-limit',
			symbol: 'hubRateLimit',
			state: 'returns-429-with-retry-after-over-the-email-start-cap',
			evidence: 'examples-cases',
			file: 'returns-429-with-retry-after-over-the-email-start-cap.json'
		},
		[
			{
				name: 'email start with count 6 and cap 5 is rate-limited',
				input: { path: '/api/auth/email/start', count: 6, cap: 5 },
				output
			}
		]
	);
});

test('Returns 429 when the counting query returns no row', async () => {
	const db = fakeDb(null, []);
	const res = await hubRateLimit({ ...base, db, request: postTo('/api/auth/google') });
	const output = await summarise(res);
	expect(output).toEqual({ status: 429, retryAfter: '60', body: { error: 'rate-limited' } });
	recordExampleCases(
		{
			unitId: 'hub.function.hub-rate-limit',
			symbol: 'hubRateLimit',
			state: 'returns-429-when-the-counting-query-returns-no-row',
			evidence: 'examples-cases',
			file: 'returns-429-when-the-counting-query-returns-no-row.json'
		},
		[
			{
				name: 'google route with no count row is rate-limited',
				input: { path: '/api/auth/google', count: null, cap: 20 },
				output
			}
		]
	);
});

test('Rejects when the D1 upsert fails', async () => {
	const request = postTo('/api/auth/challenge');
	await expect(hubRateLimit({ ...base, db: failingDb(), request })).rejects.toThrow(
		'd1 unavailable'
	);
	recordExampleCases(
		{
			unitId: 'hub.function.hub-rate-limit',
			symbol: 'hubRateLimit',
			state: 'rejects-when-the-d1-upsert-fails',
			evidence: 'examples-cases',
			file: 'rejects-when-the-d1-upsert-fails.json'
		},
		[
			{
				name: 'D1 prepare throws for the challenge route',
				input: { path: '/api/auth/challenge', ip: '203.0.113.7' },
				error: { name: 'Error', message: 'd1 unavailable' }
			}
		]
	);
});
