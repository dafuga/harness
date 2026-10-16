import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	connectHost,
	connectUrl,
	deviceHeaders,
	newRequest,
	openDevice,
	openPairing,
	ownerOf,
	pairDevice,
	pairingPath,
	registerHost
} from '../support/relayActors';
import { startRelay, type RelayFixture } from '../support/relayFixture';
import { sealedPacket } from '../support/relayPackets';
import { RelaySocket } from '../support/relaySocket';

/**
 * workerd puts a Durable Object whose sockets are all hibernatable to sleep after ten idle
 * seconds: its memory is gone and its constructor runs again for the next event. An answered
 * `ping` does not keep it awake. Each test sleeps a host of its own, so they sleep side by side.
 */
const asleepMs = 11_500;
let relay: RelayFixture;

beforeAll(async () => {
	relay = await startRelay();
}, 60_000);
afterAll(() => relay.stop());

function sleep(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, asleepMs));
}

test.concurrent(
	'a host object that slept still forwards between the sockets it had',
	async () => {
		const host = await registerHost(relay);
		const socket = await connectHost(relay, host);
		const device = await pairDevice(relay, host, socket);
		const other = await pairDevice(relay, host, socket);
		const phone = await openDevice(relay, host, { device, socket });
		const second = await openDevice(relay, host, { device: other, socket });
		await sleep();
		const sealed = sealedPacket(0);
		phone.socket.send(sealed);
		expect(await socket.next()).toEqual({
			type: 'packet',
			deviceId: device.deviceId,
			connectionId: phone.connectionId,
			packet: sealed
		});
		const answer = sealedPacket(1);
		socket.send({
			type: 'packet',
			deviceId: other.deviceId,
			connectionId: second.connectionId,
			packet: answer
		});
		expect(await second.socket.next()).toEqual(answer);
		expect(await phone.socket.drain()).toEqual([]);
		const summary = await relay.manage('summary', ownerOf(host));
		expect(await summary.json()).toMatchObject({
			online: true,
			devices: [{ online: true }, { online: true }]
		});
	},
	60_000
);

test.concurrent(
	'a host object that slept still knows its pairings, its devices and whom to close',
	async () => {
		const host = await registerHost(relay);
		const socket = await connectHost(relay, host);
		const device = await pairDevice(relay, host, socket);
		const phone = await openDevice(relay, host, { device, socket });
		const pairingId = await openPairing(socket);
		const request = await newRequest(pairingId);
		await relay.post(pairingPath(host, pairingId, 'request'), request.body);
		await socket.until('pairing-request');
		await sleep();
		const poll = await relay.post(pairingPath(host, pairingId, 'poll'), {});
		expect(await poll.json()).toMatchObject({ state: 'requested' });
		const revoke = await relay.manage('revoke-device', {
			...ownerOf(host),
			deviceId: device.deviceId
		});
		expect(revoke.status).toBe(200);
		expect((await phone.socket.closed).code).toBe(4401);
		expect(await socket.drain()).toEqual([
			{ type: 'device-close', deviceId: device.deviceId, connectionId: phone.connectionId },
			{ type: 'device-revoked', deviceId: device.deviceId }
		]);
		const refused = await RelaySocket.refusal(
			connectUrl(relay, host.hostId),
			deviceHeaders(device)
		);
		expect(refused).toMatchObject({ status: 401, error: 'credential-invalid' });
	},
	60_000
);

test.concurrent(
	'a host that returns after the object slept is told what is still open and waiting',
	async () => {
		const host = await registerHost(relay);
		const socket = await connectHost(relay, host);
		const device = await pairDevice(relay, host, socket);
		const phone = await openDevice(relay, host, { device, socket });
		const pairingId = await openPairing(socket);
		const request = await newRequest(pairingId);
		await relay.post(pairingPath(host, pairingId, 'request'), request.body);
		socket.close();
		expect(await phone.socket.next()).toEqual({ type: 'relay', event: 'host-offline' });
		await sleep();
		const back = await connectHost(relay, host);
		expect(await back.drain()).toEqual([
			{ type: 'device-open', deviceId: device.deviceId, connectionId: phone.connectionId },
			{ type: 'pairing-request', pairingId, ...request.body }
		]);
		expect(await phone.socket.next()).toEqual({ type: 'relay', event: 'host-online' });
	},
	60_000
);
