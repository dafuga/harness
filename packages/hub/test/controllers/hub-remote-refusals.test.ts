import type { Attempt } from './hub-remote-refusals.test.types';
import { expect, test } from 'vitest';
import type { HubEnv } from '../../src/configs/hubEnvConfig';
import { project, projectionFixture } from '../support/projectionFixture';
import {
	DEVICE_ID,
	HUB,
	hostIdentity,
	outcome,
	registration,
	remoteFixture
} from '../support/remoteFixture';
import type { HostIdentity, RemoteFixture } from '../support/remoteFixture';

function everyRoute(host: HostIdentity): Attempt[] {
	const path = `/hosts/${host.hostId}`;
	return [
		['POST', '/hosts', registration(host)],
		['GET', path],
		['DELETE', `${path}/devices/${DEVICE_ID}`],
		['DELETE', path]
	];
}

async function outcomes(f: RemoteFixture, attempts: Attempt[]): Promise<string[]> {
	const seen: string[] = [];
	for (const [method, path, body] of attempts)
		seen.push(await outcome(await f.send(method, path, body)));
	return seen;
}

const all = (count: number, value: string) => Array.from({ length: count }, () => value);

test('a hostId that is not derived from the hostKey is refused and never forwarded', async () => {
	const f = remoteFixture(),
		mine = await hostIdentity(),
		other = await hostIdentity();
	const swapped = registration({ hostId: mine.hostId, hostKey: other.hostKey });
	expect(await outcome(await f.send('POST', '/hosts', swapped))).toBe('400 invalid-input');
	const point = Buffer.from(mine.hostKey, 'base64url');
	point[0] = 5;
	const notAPoint = registration(mine, { hostKey: point.toString('base64url') });
	expect(await outcome(await f.send('POST', '/hosts', notAPoint))).toBe('400 invalid-input');
	expect(f.relay.calls).toEqual([]);
	expect(await outcome(await f.send('POST', '/hosts', registration(mine)))).toBe('201 ok');
});

test('malformed ids, hashes, names and bodies are refused before forwarding', async () => {
	const f = remoteFixture(),
		host = await hostIdentity(),
		{ hostId, hostKey } = host;
	const fields: Record<string, unknown>[] = [
		{ hostId: hostId.toUpperCase() },
		{ hostId: hostId.slice(1) },
		{ hostId: undefined },
		{ hostKey: `${hostKey}=` },
		{ hostKey: hostKey.slice(0, -1) },
		{ hostKey: 7 },
		{ credentialHash: 'c'.repeat(63) },
		{ credentialHash: 'C'.repeat(64) },
		{ credentialHash: undefined },
		{ name: '' },
		{ name: '   ' },
		{ name: 'n'.repeat(81) },
		{ name: 7 },
		{ name: undefined }
	];
	const attempts: Attempt[] = fields.map((field) => ['POST', '/hosts', registration(host, field)]);
	attempts.push(['POST', '/hosts', '[]'], ['POST', '/hosts', 'not json'], ['POST', '/hosts']);
	attempts.push(['GET', `/hosts/${hostId.toUpperCase()}`], ['DELETE', `/hosts/${hostId}0`]);
	attempts.push(['DELETE', `/hosts/${hostId}/devices/${DEVICE_ID.slice(1)}`]);
	attempts.push(['DELETE', `/hosts/${hostId.slice(1)}/devices/${DEVICE_ID}`]);
	expect(await outcomes(f, attempts)).toEqual(all(attempts.length, '400 invalid-input'));
	expect(f.relay.calls).toEqual([]);
	expect(await outcome(await f.send('POST', '/hosts', registration(host)))).toBe('201 ok');
});

test('without the binding or a usable relay origin every route answers remote-disabled', async () => {
	const host = await hostIdentity();
	const settings: Partial<HubEnv>[] = [
		{ REMOTE_HOSTS: undefined },
		{ HARNESS_RELAY_ORIGIN: undefined },
		{ HARNESS_RELAY_ORIGIN: '' },
		{ HARNESS_RELAY_ORIGIN: 'http://relay.fixture.example' },
		{ HARNESS_RELAY_ORIGIN: 'wss://relay.fixture.example' }
	];
	for (const env of settings) {
		const f = remoteFixture({ env });
		expect(await outcomes(f, everyRoute(host))).toEqual(all(4, '503 remote-disabled'));
		f.setActor(null);
		expect(await outcomes(f, everyRoute(host))).toEqual(all(4, '401 session-required'));
		expect(f.relay.calls).toEqual([]);
	}
	const working = remoteFixture();
	expect((await outcomes(working, everyRoute(host)))[0]).toBe('201 ok');
});

test('a relay that fails or answers something else is reported as unavailable', async () => {
	const f = remoteFixture(),
		host = await hostIdentity();
	const broken: (() => Response)[] = [
		() => {
			throw new Error('connect ECONNREFUSED relay-internal-detail');
		},
		() => new Response('<html>relay-internal-detail</html>'),
		() => Response.json({ error: 'relay-internal-detail' }, { status: 500 }),
		() => Response.json({ error: 'origin-denied' }, { status: 403 }),
		() => Response.json({ error: 'forbidden' }, { status: 500 }),
		() => Response.json({ hostId: 'relay-internal-detail', generation: '1' }),
		() => Response.json(null)
	];
	for (const respond of broken) {
		f.relay.respond = respond;
		for (const [method, path, body] of everyRoute(host)) {
			const reply = await f.send(method, path, body);
			expect([reply.status, await reply.text()]).toEqual([503, '{"error":"unavailable"}']);
		}
	}
	expect(f.relay.calls).toHaveLength(broken.length * 4);
	f.relay.respond = null;
	expect((await outcomes(f, everyRoute(host)))[0]).toBe('201 ok');
});

test('unknown remote paths and methods are refused in the hub and never forwarded', async () => {
	const f = remoteFixture(),
		host = await hostIdentity(),
		path = `/hosts/${host.hostId}`,
		body = registration(host);
	const missing: Attempt[] = [
		['GET', ''],
		['POST', '/pairings', body],
		['POST', '/manage/register', body],
		['POST', '//hosts', body],
		['POST', '/hosts/', body],
		['POST', '/%68osts', body],
		['GET', `${path}/devices`],
		['DELETE', `${path}/devices/${DEVICE_ID}/sessions`],
		['DELETE', `${path}/pairings/${DEVICE_ID}`]
	];
	expect(await outcomes(f, missing)).toEqual(all(missing.length, '404 not-found'));
	const doubled = new Request(`${HUB}/api//remote/hosts`, { method: 'POST', body: '{}' });
	expect(await outcome(await f.controller.handle(doubled))).toBe('404 not-found');
	const denied: Attempt[] = [
		['GET', '/hosts'],
		['PUT', '/hosts', body],
		['POST', path, body],
		['PATCH', path, body],
		['GET', `${path}/devices/${DEVICE_ID}`],
		['POST', `${path}/devices/${DEVICE_ID}`, body]
	];
	expect(await outcomes(f, denied)).toEqual(all(denied.length, '405 method-denied'));
	expect(f.relay.calls).toEqual([]);
	expect(await outcome(await f.send('POST', '/hosts', body))).toBe('201 ok');
});

test('hosted execution stays refused when the remote host API is enabled', async () => {
	const p = projectionFixture(),
		host = await hostIdentity();
	const f = remoteFixture({ connect: () => ({ api: p.api, projection: p.projection }) });
	const post = (url: string) =>
		f.controller.handle(
			new Request(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(registration(host))
			})
		);
	for (const operation of ['runs', 'plans', 'approve', 'changes']) {
		const hosted = await post(`${HUB}/api/projects/${project.id}/${operation}`);
		expect(await outcome(hosted)).toBe('403 hosted-execution-denied');
		const remote = await post(`${HUB}/api/remote/hosts/${host.hostId}/${operation}`);
		expect(await outcome(remote)).toBe('404 not-found');
		expect(await outcome(await post(`${HUB}/api/remote/${operation}`))).toBe('404 not-found');
	}
	expect(f.relay.calls).toEqual([]);
	expect(await outcome(await post(`${HUB}/api/remote/hosts`))).toBe('201 ok');
});
