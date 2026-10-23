import type { Summary } from './hub-remote-workerd.test.types';
import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	connectDevice,
	connectHost,
	newHost,
	pairDevice,
	type TestHost
} from '../../../relay/test/support/relayActors';
import { credentialHash } from '../../../remote/src/utils/remoteIdentity';
import { RELAY_ORIGIN, startHubRelay, type HubRelayFixture } from '../support/hubRelayFixture';

/** The hub's controller and the relay's host objects in workerd, joined by a namespace binding. */
let f: HubRelayFixture;
beforeAll(async () => {
	f = await startHubRelay();
}, 120_000);
afterAll(async () => {
	await f?.stop();
});
const owner = 'session-owner',
	other = 'session-other',
	limit = 60_000;
async function registration(host: TestHost, extra: Record<string, unknown> = {}) {
	const { hostId, hostKey, credential, name } = host,
		hash = await credentialHash({ role: 'host', hostId, credential });
	return { hostId, hostKey, name, credentialHash: hash, ...extra };
}
const outcome = async (response: Response) => {
	const body = (await response.json()) as { error?: string };
	return `${response.status} ${body.error ?? 'ok'}`;
};
const summaryOf = async (session: string, hostId: string) =>
	(await (await f.hub(session, 'GET', `/hosts/${hostId}`)).json()) as Summary;

test(
	'a host is registered under the owner of the session, whatever the body claims',
	async () => {
		const host = await newHost(),
			path = `/hosts/${host.hostId}`,
			forged = { id: 'google:fixture-other' },
			claims = { owner: forged, ownerId: forged.id, actor: forged };
		expect(await outcome(await f.hub(null, 'POST', '/hosts', await registration(host)))).toBe(
			'401 session-required'
		);
		expect(await outcome(await f.hub(owner, 'GET', path))).toBe('404 not-found');
		const registered = await f.hub(owner, 'POST', '/hosts', await registration(host, claims));
		expect(registered.status).toBe(201);
		const answer = (await registered.json()) as Summary;
		expect(answer).toEqual({
			hostId: host.hostId,
			origin: RELAY_ORIGIN,
			generation: expect.any(Number) as number,
			registeredAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as string
		});
		expect(await outcome(await f.hub(other, 'GET', path))).toBe('403 forbidden');
		expect(await outcome(await f.hub(other, 'POST', '/hosts', await registration(host)))).toBe(
			'403 forbidden'
		);
		expect(await summaryOf(owner, host.hostId)).toEqual({
			hostId: host.hostId,
			name: host.name,
			online: false,
			generation: answer.generation,
			registeredAt: answer.registeredAt,
			devices: []
		});
		const socket = await connectHost(f.relay, host);
		expect((await summaryOf(owner, host.hostId)) as unknown).toMatchObject({ online: true });
		socket.close();
	},
	limit
);

test(
	'summary, revocation and removal act on the real object and keep their shapes',
	async () => {
		const host = await newHost(),
			path = `/hosts/${host.hostId}`;
		expect((await f.hub(owner, 'POST', '/hosts', await registration(host))).status).toBe(201);
		const socket = await connectHost(f.relay, host),
			device = await pairDevice(f.relay, host, socket),
			phone = await connectDevice(f.relay, host, device),
			devicePath = `${path}/devices/${device.deviceId}`;
		await socket.until('device-open');
		const [listed] = (await summaryOf(owner, host.hostId)).devices;
		expect(listed).toMatchObject({ deviceId: device.deviceId, online: true });
		expect(Object.keys(listed).sort()).toEqual(['createdAt', 'deviceId', 'lastSeenAt', 'online']);
		expect(await outcome(await f.hub(other, 'DELETE', devicePath))).toBe('403 forbidden');
		expect(await outcome(await f.hub(null, 'DELETE', devicePath))).toBe('401 session-required');
		const revoked = await f.hub(owner, 'DELETE', devicePath);
		expect([revoked.status, await revoked.json()]).toEqual([200, { ok: true }]);
		expect((await phone.closed).code).toBe(4401);
		expect(await socket.until('device-revoked')).toMatchObject({ deviceId: device.deviceId });
		expect((await summaryOf(owner, host.hostId)).devices).toEqual([]);
		expect(await outcome(await f.hub(other, 'DELETE', path))).toBe('403 forbidden');
		const removed = await f.hub(owner, 'DELETE', path);
		expect([removed.status, await removed.json()]).toEqual([200, { ok: true }]);
		expect((await socket.closed).code).toBe(4401);
		expect(await outcome(await f.hub(owner, 'GET', path))).toBe('404 not-found');
		const direct = { owner: { id: 'google:fixture-owner' }, hostId: host.hostId };
		expect((await f.relay.post('/manage/summary', direct)).status).toBe(404);
	},
	limit
);

test(
	'without the binding the API is disabled, and a failing object is never passed on raw',
	async () => {
		const host = await newHost(),
			body = await registration(host),
			path = `/hosts/${host.hostId}`;
		expect(await outcome(await f.unbound(owner, 'POST', '/hosts', body))).toBe(
			'503 remote-disabled'
		);
		const failed = await f.broken(owner, 'POST', '/hosts', body),
			text = await failed.text();
		expect(failed.status).toBe(503);
		expect(JSON.parse(text)).toEqual({ error: 'unavailable' });
		expect(text).not.toContain('synthetic');
		expect(await outcome(await f.broken(owner, 'GET', path))).toBe('503 unavailable');
		expect(await outcome(await f.broken(owner, 'DELETE', path))).toBe('503 unavailable');
		const mismatched = { ...body, hostId: 'f'.repeat(40) };
		expect(await outcome(await f.hub(owner, 'POST', '/hosts', mismatched))).toBe(
			'400 invalid-input'
		);
		expect(await outcome(await f.hub(owner, 'GET', path))).toBe('404 not-found');
	},
	limit
);
