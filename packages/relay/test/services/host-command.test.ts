import { afterAll, beforeAll, expect, test } from 'vitest';
import { randomId } from '../../../remote/src/index';
import {
	connectDevice,
	connectHost,
	openDevice,
	pairDevice,
	registerHost,
	type TestDevice,
	type TestHost
} from '../support/relayActors';
import { startRelay, type RelayFixture } from '../support/relayFixture';
import { acceptPacket, helloPacket, sealedPacket } from '../support/relayPackets';
import type { RelaySocket } from '../support/relaySocket';

interface Phone {
	device: TestDevice;
	socket: RelaySocket;
	connectionId: string;
}
interface Address {
	deviceId: string;
	connectionId: string;
}
let relay: RelayFixture;
let host: TestHost;
let socket: RelaySocket;
let alpha: Phone;
let beta: Phone;

async function phone(): Promise<Phone> {
	const device = await pairDevice(relay, host, socket);
	return { device, ...(await openDevice(relay, host, { device, socket })) };
}

beforeAll(async () => {
	relay = await startRelay();
	host = await registerHost(relay);
	socket = await connectHost(relay, host);
	alpha = await phone();
	beta = await phone();
}, 60_000);
afterAll(() => relay.stop());

/** The host addresses a packet to a phone, or to what `change` makes of its address. */
function toPhone(target: Phone, packet: unknown, change: Partial<Address> = {}): void {
	const address = {
		deviceId: target.device.deviceId,
		connectionId: target.connectionId,
		...change
	};
	socket.send({ type: 'packet', ...address, packet });
}

test('a packet of a device reaches the host with the ids the relay gave it', async () => {
	const hello = await helloPacket(alpha.device.deviceId);
	alpha.socket.send(hello);
	expect(await socket.next()).toEqual({
		type: 'packet',
		deviceId: alpha.device.deviceId,
		connectionId: alpha.connectionId,
		packet: hello
	});
	const sealed = sealedPacket(0);
	beta.socket.send(sealed);
	expect(await socket.next()).toEqual({
		type: 'packet',
		deviceId: beta.device.deviceId,
		connectionId: beta.connectionId,
		packet: sealed
	});
	expect(await alpha.socket.drain()).toEqual([]);
	expect(await beta.socket.drain()).toEqual([]);
});

test('a device cannot speak under the id of another', async () => {
	const forged = await helloPacket(beta.device.deviceId);
	alpha.socket.send(forged);
	const frame = await socket.next();
	expect(frame).toMatchObject({
		deviceId: alpha.device.deviceId,
		connectionId: alpha.connectionId
	});
	expect(await beta.socket.drain()).toEqual([]);
});

test('a packet of the host reaches the connection it names and no other', async () => {
	const accept = await acceptPacket();
	toPhone(alpha, accept);
	expect(await alpha.socket.next()).toEqual(accept);
	const sealed = sealedPacket(7);
	toPhone(beta, sealed);
	expect(await beta.socket.next()).toEqual(sealed);
	const reject = { type: 'reject', reason: 'busy' };
	toPhone(alpha, reject);
	expect(await alpha.socket.next()).toEqual(reject);
	expect(await alpha.socket.drain()).toEqual([]);
	expect(await beta.socket.drain()).toEqual([]);
	expect(await socket.drain()).toEqual([]);
});

test('a packet for a connection that is unknown or of another device is dropped', async () => {
	toPhone(alpha, sealedPacket(1), { connectionId: randomId() });
	toPhone(alpha, sealedPacket(2), { connectionId: beta.connectionId });
	toPhone(alpha, sealedPacket(3), { deviceId: beta.device.deviceId });
	expect(await alpha.socket.drain()).toEqual([]);
	expect(await beta.socket.drain()).toEqual([]);
	expect(await socket.drain()).toEqual([]);
	const sealed = sealedPacket(4);
	toPhone(alpha, sealed);
	expect(await alpha.socket.next()).toEqual(sealed);
});

test('a late packet for a connection that closed is dropped', async () => {
	const gone = await phone();
	gone.socket.close();
	await gone.socket.closed;
	await socket.until('device-close');
	toPhone(gone, sealedPacket(0));
	const back = await openDevice(relay, host, { device: gone.device, socket });
	expect(back.connectionId).not.toBe(gone.connectionId);
	toPhone(gone, sealedPacket(1));
	expect(await back.socket.drain()).toEqual([]);
	const sealed = sealedPacket(2);
	toPhone({ ...gone, connectionId: back.connectionId }, sealed);
	expect(await back.socket.next()).toEqual(sealed);
	back.socket.close();
	await socket.until('device-close');
});

test('device-drop closes the connection it names with the code of the host', async () => {
	const dropped = await phone();
	socket.send({
		type: 'device-drop',
		deviceId: beta.device.deviceId,
		connectionId: dropped.connectionId,
		code: 4408
	});
	expect(await dropped.socket.drain()).toEqual([]);
	const address = { deviceId: dropped.device.deviceId, connectionId: dropped.connectionId };
	socket.send({ type: 'device-drop', ...address, code: 4408 });
	expect((await dropped.socket.closed).code).toBe(4408);
	expect(await socket.next()).toEqual({ type: 'device-close', ...address });
	expect(await socket.drain()).toEqual([]);
});

test('packets of a device are dropped and answered host-offline while the host is away', async () => {
	const lonely = await registerHost(relay);
	const first = await connectHost(relay, lonely);
	const device = await pairDevice(relay, lonely, first);
	first.close();
	await first.closed;
	const waiting = await connectDevice(relay, lonely, device);
	waiting.send(await helloPacket(device.deviceId));
	waiting.send(sealedPacket(0));
	const offline = { type: 'relay', event: 'host-offline' };
	expect(await waiting.drain()).toEqual([offline, offline]);
	const back = await connectHost(relay, lonely);
	expect(await back.drain()).toEqual([
		{ type: 'device-open', deviceId: device.deviceId, connectionId: expect.any(String) }
	]);
	waiting.close();
	back.close();
});
