import { expect, test, vi } from 'vitest';
import { measureWorkload } from '../../../../test/support/measureWorkload';

// The owner policy reads the environment once, when the guard is first used: the owner mode of
// Harness's own local server, bound to loopback, is set before anything is imported.
vi.hoisted(() => {
	process.env.HARNESS_OWNER_MODE = 'loopback';
	process.env.HARNESS_BIND = '127.0.0.1';
	delete process.env.ADDRESS_HEADER;
});

const readProjectOverview = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/projects-sessions/project-overview/readProjectOverview', () => ({
	readProjectOverview
}));

import * as route from '../../src/routes/api/project-overview/+server';

/** A synthetic tracker snapshot: the only payload the route may ever return. */
const ready = {
	status: 'ready',
	projects: [
		{
			agent: 'synthetic-project',
			state: 'active',
			liveSessions: 1,
			counts: { open: 0, in_progress: 1, blocked: 0, done: 0 },
			items: [
				{
					id: 'synthetic-item',
					title: 'Synthetic item',
					status: 'in_progress',
					updatedAt: '2026-11-20T10:00:00.000Z',
					due: null,
					live: true,
					stale: false
				}
			],
			attention: null,
			blocked: null,
			milestone: null,
			updatedAt: '2026-11-20T10:00:00.000Z'
		}
	],
	machines: [{ name: 'synthetic-machine', status: 'ok' }],
	liveSessions: 1
};

const unavailable = { status: 'unavailable' };

/** A local request: the URL and Host header name the loopback host, from a loopback peer. */
function request(
	path: string,
	headers: Record<string, string> = {},
	peer = '127.0.0.1'
): Parameters<typeof route.GET>[0] {
	const url = new URL(path);
	const hostHeader = headers.host ?? url.host;
	return {
		url,
		request: new Request(url, { headers: { host: hostHeader, ...headers } }),
		getClientAddress: () => peer
	} as unknown as Parameters<typeof route.GET>[0];
}

const local = 'http://127.0.0.1:4173/api/project-overview';

test('the route is GET only, and nothing else is exported', () => {
	expect(Object.keys(route).sort()).toEqual(['GET']);
});

test('a local owner request answers the fixed payload, uncached, without CORS', async () => {
	readProjectOverview.mockResolvedValue(ready);
	const response = await measureWorkload(
		'reports.module.project-overview-website',
		'get-project-overview',
		() => route.GET(request(local))
	);
	expect(response.status).toBe(200);
	expect(response.headers.get('cache-control')).toBe('no-store');
	expect(response.headers.get('access-control-allow-origin')).toBeNull();
	expect(await response.json()).toEqual(ready);
	expect(readProjectOverview).toHaveBeenCalledTimes(1);
	expect(readProjectOverview.mock.calls[0]).toEqual([]);
});

test('a local request the reader cannot answer is unavailable, with no detail', async () => {
	readProjectOverview.mockResolvedValue(unavailable);
	const refused = await route.GET(request('http://localhost:4173/api/project-overview'));
	expect(refused.status).toBe(503);
	expect(await refused.json()).toEqual(unavailable);
	readProjectOverview.mockRejectedValue(new Error('/private/path token=synthetic'));
	const thrown = await route.GET(request('http://localhost:4173/api/project-overview'));
	expect(thrown.status).toBe(503);
	const text = await thrown.text();
	expect(JSON.parse(text)).toEqual(unavailable);
	expect(text).not.toMatch(/private|token|synthetic/);
});

test('any request that is not the owner on loopback is refused before the reader runs', async () => {
	readProjectOverview.mockClear();
	const cases: Array<[string, Record<string, string>, string]> = [
		['remote peer', {}, '203.0.113.7'],
		['rebound Host', { host: 'attacker.example' }, '127.0.0.1'],
		['Host differs from the URL', { host: 'localhost:4173' }, '127.0.0.1'],
		['forwarded address', { 'x-forwarded-for': '203.0.113.7' }, '127.0.0.1'],
		['forwarded host', { 'x-forwarded-host': 'attacker.example' }, '127.0.0.1'],
		['cross-site fetch', { 'sec-fetch-site': 'cross-site' }, '127.0.0.1'],
		['same-site fetch', { 'sec-fetch-site': 'same-site' }, '127.0.0.1'],
		['foreign origin', { origin: 'https://attacker.example' }, '127.0.0.1']
	];
	for (const [, headers, peer] of cases) {
		const response = await route.GET(request(local, headers, peer));
		expect(response.status).toBe(403);
		expect(await response.json()).toEqual(unavailable);
		expect(response.headers.get('cache-control')).toBe('no-store');
	}
	expect(readProjectOverview).not.toHaveBeenCalled();
});

test('a same-origin fetch from the owner page is admitted', async () => {
	readProjectOverview.mockResolvedValue(ready);
	const response = await route.GET(
		request(local, {
			'sec-fetch-site': 'same-origin',
			origin: 'http://127.0.0.1:4173'
		})
	);
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual(ready);
});
