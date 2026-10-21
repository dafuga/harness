import { afterAll, beforeAll, expect, test } from 'vitest';
import { randomId } from '../../../remote/src/index';
import { newHost, ownerOf, registerHost, registration } from '../support/relayActors';
import { startRelay, type RelayFixture } from '../support/relayFixture';

const json = { 'Content-Type': 'application/json' };
const operations = ['register', 'summary', 'revoke-device', 'unregister'];
let relay: RelayFixture;

beforeAll(async () => {
	relay = await startRelay();
}, 60_000);
afterAll(() => relay.stop());

async function answer(response: Response): Promise<[number, unknown]> {
	return [response.status, await response.json()];
}

test('health answers the protocol, never cached and never sniffed', async () => {
	const response = await relay.profile(
		{
			units: ['relay.entry.index', 'relay.controller.public-relay'],
			workload: 'local-health-request'
		},
		() => relay.fetch('/v1/health')
	);
	expect(response.headers.get('Cache-Control')).toBe('no-store');
	expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
	expect(response.headers.get('Content-Type')).toBe('application/json');
	expect(await answer(response)).toEqual([200, { ok: true, protocol: 1 }]);
});

test('the public Worker serves no management call, whatever the verb', async () => {
	const host = await newHost();
	const body = JSON.stringify(await registration(host));
	for (const operation of operations) {
		for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'GET']) {
			const init = method === 'GET' ? { method } : { method, headers: json, body };
			const response = await relay.fetch(`/manage/${operation}`, init);
			expect(await answer(response), `${method} ${operation}`).toEqual([
				404,
				{ error: 'not-found' }
			]);
			expect(response.headers.get('Cache-Control')).toBe('no-store');
		}
	}
	const summary = await relay.manage('summary', ownerOf(host));
	expect(await answer(summary)).toEqual([404, { error: 'not-found' }]);
	expect(await relay.rows(host.hostId)).toEqual([]);
});

test('no path leads from the public Worker to management', async () => {
	const host = await newHost();
	const body = JSON.stringify(await registration(host));
	const base = `/v1/hosts/${host.hostId}`;
	const paths = [
		'/manage',
		'/manage/',
		'//manage/register',
		'/MANAGE/register',
		'/v1/manage/register',
		`${base}/manage/register`,
		`${base}/connect/manage/register`,
		`${base}/pairings/${randomId()}/manage/register`,
		`${base}/pairings/..%2f..%2f..%2f..%2fmanage%2fregister`,
		`${base}/connect/%2e%2e/%2e%2e/%2e%2e/%2e%2e/manage/register`,
		`/manage/register?hostId=${host.hostId}`,
		'/manage/register#x'
	];
	for (const path of paths) {
		const response = await relay.fetch(path, { method: 'POST', headers: json, body });
		expect(await answer(response), path).toEqual([404, { error: 'not-found' }]);
	}
	expect(await relay.rows(host.hostId)).toEqual([]);
});

test('a registered host is not manageable from the public Worker either', async () => {
	const host = await registerHost(relay);
	for (const operation of operations) {
		const body = JSON.stringify({ ...(await registration(host)), deviceId: 'd4'.repeat(20) });
		const response = await relay.fetch(`/manage/${operation}`, {
			method: 'POST',
			headers: json,
			body
		});
		expect(await answer(response), operation).toEqual([404, { error: 'not-found' }]);
	}
	const summary = await relay.manage('summary', ownerOf(host));
	expect(summary.status).toBe(200);
	expect(await summary.json()).toMatchObject({ hostId: host.hostId, generation: 1 });
});

test('unknown routes and verbs are not found', async () => {
	const host = await registerHost(relay);
	const base = `/v1/hosts/${host.hostId}`;
	const pairing = `${base}/pairings/${randomId()}`;
	const requests: [string, string][] = [
		['GET', '/'],
		['GET', '/v1'],
		['GET', '/v1/hosts'],
		['GET', base],
		['POST', '/v1/health'],
		['GET', '/v1/health/'],
		['POST', `${base}/connect`],
		['GET', `${base}/connect/`],
		['DELETE', pairing],
		['POST', pairing],
		['GET', `${pairing}/poll`],
		['GET', `${pairing}/exchange`],
		['PUT', `${pairing}/request`],
		['POST', `${pairing}/approve`],
		['GET', `${base}/devices`]
	];
	for (const [method, path] of requests) {
		const init = method === 'GET' ? { method } : { method, headers: json, body: '{}' };
		const response = await relay.fetch(path, init);
		expect(await answer(response), `${method} ${path}`).toEqual([404, { error: 'not-found' }]);
	}
});

test('a host or pairing id of another shape is not found and reaches no object', async () => {
	const host = await registerHost(relay);
	const pairingId = randomId();
	const paths = [
		`/v1/hosts/${host.hostId.toUpperCase()}/pairings/${pairingId}`,
		`/v1/hosts/${host.hostId.slice(2)}/pairings/${pairingId}`,
		`/v1/hosts/${host.hostId}00/pairings/${pairingId}`,
		`/v1/hosts/${'z'.repeat(40)}/pairings/${pairingId}`,
		`/v1/hosts/${host.hostId}/pairings/${pairingId.slice(2)}`,
		`/v1/hosts/${host.hostId}/pairings/${pairingId.toUpperCase()}`,
		`/v1/hosts/${host.hostId}/pairings/${'z'.repeat(32)}`
	];
	for (const path of paths) {
		expect(await answer(await relay.fetch(path)), path).toEqual([404, { error: 'not-found' }]);
	}
});
