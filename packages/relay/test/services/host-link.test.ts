import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	connectDevice,
	connectHost,
	connectUrl,
	hostHeaders,
	newRequest,
	openDevice,
	openPairing,
	pairDevice,
	pairingPath,
	registerHost,
	type TestDevice,
	type TestHost
} from '../support/relayActors';
import { startRelay, type RelayFixture } from '../support/relayFixture';
import { RelaySocket } from '../support/relaySocket';

const online = { type: 'relay', event: 'host-online' };
const offline = { type: 'relay', event: 'host-offline' };
let relay: RelayFixture;

beforeAll(async () => {
	relay = await startRelay();
}, 60_000);
afterAll(() => relay.stop());

async function paired(): Promise<{ host: TestHost; socket: RelaySocket; device: TestDevice }> {
	const host = await registerHost(relay);
	const socket = await connectHost(relay, host);
	return { host, socket, device: await pairDevice(relay, host, socket) };
}

test('devices are told when the host goes and when it comes back', async () => {
	const { host, socket, device } = await paired();
	const other = await pairDevice(relay, host, socket);
	const first = await connectDevice(relay, host, device);
	const second = await connectDevice(relay, host, other);
	await socket.until('device-open');
	await socket.until('device-open');
	socket.close();
	expect(await first.next()).toEqual(offline);
	expect(await second.next()).toEqual(offline);
	const back = await connectHost(relay, host);
	expect(await first.next()).toEqual(online);
	expect(await second.next()).toEqual(online);
	expect(await first.drain()).toEqual([]);
	first.close();
	second.close();
	back.close();
});

test('a returning host is told every connection that is still open', async () => {
	const { host, socket, device } = await paired();
	const idle = await pairDevice(relay, host, socket);
	const phone = await openDevice(relay, host, { device, socket });
	socket.close();
	await socket.closed;
	const back = await RelaySocket.open(connectUrl(relay, host.hostId), hostHeaders(host));
	const ready = (await back.next()) as { devices: { deviceId: string; online: boolean }[] };
	expect(ready.devices).toHaveLength(2);
	expect(ready.devices).toContainEqual({ deviceId: device.deviceId, online: true });
	expect(ready.devices).toContainEqual({ deviceId: idle.deviceId, online: false });
	expect(await back.drain()).toEqual([
		{ type: 'device-open', deviceId: device.deviceId, connectionId: phone.connectionId }
	]);
	phone.socket.close();
	back.close();
});

test('a returning host receives ready, then open connections, then waiting requests', async () => {
	const { host, socket, device } = await paired();
	const phone = await openDevice(relay, host, { device, socket });
	const pairingId = await openPairing(socket);
	const request = await newRequest(pairingId);
	await relay.post(pairingPath(host, pairingId, 'request'), request.body);
	const back = await RelaySocket.open(connectUrl(relay, host.hostId), hostHeaders(host));
	const frames = (await back.drain()) as { type: string }[];
	expect(frames.map((frame) => frame.type)).toEqual(['ready', 'device-open', 'pairing-request']);
	expect(frames[2]).toEqual({ type: 'pairing-request', pairingId, ...request.body });
	phone.socket.close();
	back.close();
});

test('the host is told when a device comes and when it leaves', async () => {
	const { host, socket, device } = await paired();
	const phone = await connectDevice(relay, host, device);
	const opened = await socket.next();
	expect(opened).toEqual({
		type: 'device-open',
		deviceId: device.deviceId,
		connectionId: opened.connectionId
	});
	expect(opened.connectionId).toMatch(/^[a-f0-9]{32}$/);
	expect(await phone.drain()).toEqual([]);
	phone.close();
	expect(await socket.next()).toEqual({
		type: 'device-close',
		deviceId: device.deviceId,
		connectionId: opened.connectionId
	});
	expect(await socket.drain()).toEqual([]);
	socket.close();
});

test('nothing is announced to a host that is not connected, and nothing is kept for it', async () => {
	const { host, socket, device } = await paired();
	socket.close();
	await socket.closed;
	const phone = await connectDevice(relay, host, device);
	phone.close();
	await phone.closed;
	const back = await RelaySocket.open(connectUrl(relay, host.hostId), hostHeaders(host));
	expect(await back.drain()).toEqual([
		{ type: 'ready', hostId: host.hostId, devices: [{ deviceId: device.deviceId, online: false }] }
	]);
	back.close();
});
