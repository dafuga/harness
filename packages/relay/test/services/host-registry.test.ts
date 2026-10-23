import type { Registered } from './host-registry.test.types';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { randomCredential } from '../../../remote/src/index';
import {
	connectDevice,
	connectHost,
	connectUrl,
	hostHeaders,
	ownerOf,
	pairDevice,
	registerHost,
	registration,
	type TestHost
} from '../support/relayActors';
import { startRelay, type RelayFixture } from '../support/relayFixture';
import { RelaySocket } from '../support/relaySocket';
let relay: RelayFixture;

beforeAll(async () => {
	relay = await startRelay();
}, 60_000);
afterAll(() => relay.stop());

async function register(host: TestHost): Promise<Registered> {
	const response = await relay.manage('register', await registration(host));
	expect(response.status).toBe(200);
	return (await response.json()) as Registered;
}

test('registering again as the same owner rotates the credential', async () => {
	const host = await registerHost(relay);
	const first = (await (await relay.manage('summary', ownerOf(host))).json()) as Registered;
	const rotated = { ...host, credential: randomCredential(), name: 'Renamed Mac' };
	const second = await register(rotated);
	expect(second).toEqual({ hostId: host.hostId, generation: 2, registeredAt: first.registeredAt });
	const url = connectUrl(relay, host.hostId);
	expect(await RelaySocket.refusal(url, hostHeaders(host))).toMatchObject({
		status: 401,
		error: 'credential-invalid'
	});
	const socket = await connectHost(relay, rotated);
	const summary = await relay.manage('summary', ownerOf(host));
	expect(await summary.json()).toMatchObject({ name: 'Renamed Mac', generation: 2, online: true });
	expect((await register({ ...rotated, credential: randomCredential() })).generation).toBe(3);
	socket.close();
});

test('a rotation ends the open host socket and tells the devices', async () => {
	const host = await registerHost(relay);
	const socket = await connectHost(relay, host);
	const device = await pairDevice(relay, host, socket);
	const phone = await connectDevice(relay, host, device);
	await socket.until('device-open');
	const rotated = { ...host, credential: randomCredential() };
	await register(rotated);
	expect((await socket.closed).code).toBe(4401);
	expect(await phone.drain()).toEqual([{ type: 'relay', event: 'host-offline' }]);
	const again = await connectHost(relay, rotated);
	expect(await phone.next()).toEqual({ type: 'relay', event: 'host-online' });
	expect(await again.next()).toMatchObject({ type: 'device-open', deviceId: device.deviceId });
	phone.close();
	again.close();
});

test('a rotation keeps the devices of a host', async () => {
	const host = await registerHost(relay);
	const socket = await connectHost(relay, host);
	const device = await pairDevice(relay, host, socket);
	const rotated = { ...host, credential: randomCredential() };
	await register(rotated);
	const summary = await relay.manage('summary', ownerOf(host));
	const devices = ((await summary.json()) as { devices: { deviceId: string }[] }).devices;
	expect(devices.map((item) => item.deviceId)).toEqual([device.deviceId]);
	const phone = await connectDevice(relay, host, device);
	expect(await phone.drain()).toEqual([]);
	phone.close();
});

test('a registration that is refused changes nothing', async () => {
	const host = await registerHost(relay, 'owner-a');
	const socket = await connectHost(relay, host);
	const intruder = { ...host, ownerId: 'owner-b', credential: randomCredential() };
	const refused = await relay.manage('register', await registration(intruder));
	expect(refused.status).toBe(403);
	const malformed = await relay.manage('register', {
		...(await registration(host)),
		credentialHash: 'x'
	});
	expect(malformed.status).toBe(400);
	const summary = await relay.manage('summary', ownerOf(host));
	expect(await summary.json()).toMatchObject({ generation: 1, online: true });
	const url = connectUrl(relay, host.hostId);
	expect((await RelaySocket.refusal(url, hostHeaders(intruder))).status).toBe(401);
	socket.close();
});
