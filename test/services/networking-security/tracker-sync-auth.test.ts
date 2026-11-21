import { expect, test } from 'vitest';
import { TrackerSyncAuthService } from '../../../src/services/networking-security/TrackerSyncAuthService';
import { measureWorkload } from '../../support/measureWorkload';

const auth = new TrackerSyncAuthService('synthetic tracker signing key');
const timestamp = 1_700_000_000_000;
const pull = { method: 'GET', pathAndQuery: '/sync/pull?since=42&wait=0&limit=500&fixture=%2f' };
// Golden signatures from the pinned Tracker 2ccd8982 authHeader with synthetic input.
const vectors = [
	[pull, '59f1b37ded5fbdf1336c06ce86829bb53aba11001e7f7dcc8e5545e025651a35'],
	[
		{
			method: 'POST',
			pathAndQuery: '/sync/push',
			body: '{"node":"fixture-spoke","ops":[{"seq":1,"op_id":"fixture:1","fields":{"title":"café ☕"}}]}'
		},
		'86daaae63a2b0517d3d028c9b19917c0111f3179bb7cba7322a26ef80e9ffcb0'
	],
	[
		{ method: 'GET', pathAndQuery: '/sync/health' },
		'fa4549500147d838c4bbdc3e36d5689d79c6f4701d66d9a3d0f80e5373505afc'
	],
	[
		{
			method: 'POST',
			pathAndQuery: '/sync/permit-due',
			body: '{"id":"fixture-task","token":"fixture-due"}'
		},
		'2bc1926e1e6e4813beedb25059f54134bb48836b91f85d985f94694a0fda3c53'
	],
	[
		{
			method: 'POST',
			pathAndQuery: '/sync/machine',
			body: '{"sample":{"node":"fixture-spoke","cpu_count":4}}'
		},
		'9705e22858a50c6c0f5edfd081273caad031d37614babc7b412b71c43ad527cb'
	]
] as const;

test('authorizationHeader produces the pinned legacy header for all five sync routes', async () => {
	await measureWorkload(
		'service.networking-security-tracker-sync-auth',
		'sign-five-legacy-wire-vectors',
		() => {
			for (const [request, digest] of vectors) {
				expect(auth.authorizationHeader(request, timestamp)).toBe(
					`TrackerHMAC ts=${timestamp},sig=${digest}`
				);
			}
		}
	);
});

test('verify accepts pinned legacy headers throughout the inclusive clock window', async () => {
	await measureWorkload(
		'service.networking-security-tracker-sync-auth',
		'verify-five-legacy-wire-vectors',
		() => {
			for (const [request, digest] of vectors) {
				const header = `TrackerHMAC ts=${timestamp},sig=${digest}`;
				expect(auth.verify(request, header, timestamp)).toBe(true);
				expect(auth.verify(request, header, timestamp - 300_000)).toBe(true);
				expect(auth.verify(request, header, timestamp + 300_000)).toBe(true);
			}
		}
	);
});

test('verify rejects changed wire bytes, a different key, missing credentials and out-of-window timestamps', () => {
	expect(JSON.stringify(auth)).toBe('{}');
	const header = `TrackerHMAC ts=${timestamp},sig=${vectors[0][1]}`;
	expect(auth.verify({ ...pull, method: 'POST' }, header, timestamp)).toBe(false);
	expect(
		auth.verify(
			{ ...pull, pathAndQuery: '/sync/pull?wait=0&since=42&limit=500&fixture=%2f' },
			header,
			timestamp
		)
	).toBe(false);
	expect(
		auth.verify(
			{ ...pull, pathAndQuery: pull.pathAndQuery.replace('%2f', '%2F') },
			header,
			timestamp
		)
	).toBe(false);
	const [push, digest] = vectors[1];
	expect(
		auth.verify(
			{ ...push, body: push.body + ' ' },
			`TrackerHMAC ts=${timestamp},sig=${digest}`,
			timestamp
		)
	).toBe(false);
	expect(new TrackerSyncAuthService('other fixture key').verify(pull, header, timestamp)).toBe(
		false
	);
	expect(auth.verify(pull, header, timestamp - 300_001)).toBe(false);
	expect(auth.verify(pull, header, timestamp + 300_001)).toBe(false);
	expect(auth.verify(pull, header.slice(0, -1), timestamp)).toBe(false);
	expect(auth.verify(pull, undefined, timestamp)).toBe(false);
});
