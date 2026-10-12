import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	command,
	connectHost,
	connectUrl,
	deviceHeaders,
	newIdentity,
	openDevice,
	ownerOf,
	pairDevice,
	pairingPath,
	registerHost,
	requestPairing,
	sealedText,
	type TestHost
} from '../support/relayActors';
import { startRelay, type RelayFixture } from '../support/relayFixture';
import { sealedPacket } from '../support/relayPackets';
import { RelaySocket } from '../support/relaySocket';

const invalid = { status: 401, error: 'credential-invalid' };
let relay: RelayFixture;
let host: TestHost;
let socket: RelaySocket;
let url: string;

beforeAll(async () => {
	relay = await startRelay();
	host = await registerHost(relay);
	socket = await connectHost(relay, host);
	url = connectUrl(relay, host.hostId);
}, 60_000);
afterAll(() => relay.stop());

async function deviceIds(): Promise<string[]> {
	const summary = await relay.manage('summary', ownerOf(host));
	return ((await summary.json()) as { devices: { deviceId: string }[] }).devices.map(
		(item) => item.deviceId
	);
}

test('device-revoke of the host closes the device and refuses its credential', async () => {
	const device = await pairDevice(relay, host, socket);
	const phone = await openDevice(relay, host, { device, socket });
	const address = { deviceId: device.deviceId, connectionId: phone.connectionId };
	socket.send({ type: 'device-revoke', ref: 'revoke-1', deviceId: device.deviceId });
	expect((await phone.socket.closed).code).toBe(4401);
	expect(await socket.drain()).toEqual([
		{ type: 'device-close', ...address },
		{ type: 'device-revoked', deviceId: device.deviceId },
		{ type: 'ack', ref: 'revoke-1', ok: true }
	]);
	expect(await RelaySocket.refusal(url, deviceHeaders(device))).toMatchObject(invalid);
	expect(await deviceIds()).not.toContain(device.deviceId);
	const rows = await relay.rows(host.hostId);
	expect(rows.map((row) => row.key)).not.toContain(`device:${device.deviceId}`);
});

test('revoke-device through management does the same and tells the host', async () => {
	const device = await pairDevice(relay, host, socket);
	const kept = await pairDevice(relay, host, socket);
	const phone = await openDevice(relay, host, { device, socket });
	const other = await openDevice(relay, host, { device: kept, socket });
	const response = await relay.manage('revoke-device', {
		...ownerOf(host),
		deviceId: device.deviceId
	});
	expect([response.status, await response.json()]).toEqual([200, { ok: true }]);
	expect((await phone.socket.closed).code).toBe(4401);
	expect(await socket.drain()).toEqual([
		{ type: 'device-close', deviceId: device.deviceId, connectionId: phone.connectionId },
		{ type: 'device-revoked', deviceId: device.deviceId }
	]);
	expect(await RelaySocket.refusal(url, deviceHeaders(device))).toMatchObject(invalid);
	expect(await deviceIds()).toContain(kept.deviceId);
	expect(await deviceIds()).not.toContain(device.deviceId);
	expect(await other.socket.drain()).toEqual([]);
	other.socket.close();
	await socket.until('device-close');
});

test('a late packet of the host for a revoked connection is not delivered', async () => {
	const device = await pairDevice(relay, host, socket);
	const kept = await pairDevice(relay, host, socket);
	const phone = await openDevice(relay, host, { device, socket });
	const other = await openDevice(relay, host, { device: kept, socket });
	const address = { deviceId: device.deviceId, connectionId: phone.connectionId };
	socket.send({ type: 'device-revoke', ref: 'revoke-2', deviceId: device.deviceId });
	socket.send({ type: 'packet', ...address, packet: sealedPacket(0) });
	await socket.until('ack');
	socket.send({ type: 'packet', ...address, packet: sealedPacket(1) });
	const close = await phone.socket.closed;
	expect(close.code).toBe(4401);
	expect(await phone.socket.drain()).toEqual([]);
	expect(await other.socket.drain()).toEqual([]);
	const sealed = sealedPacket(2);
	socket.send({
		type: 'packet',
		deviceId: kept.deviceId,
		connectionId: other.connectionId,
		packet: sealed
	});
	expect(await other.socket.next()).toEqual(sealed);
	expect(await socket.drain()).toEqual([]);
	other.socket.close();
	await socket.until('device-close');
});

test('a revocation is acknowledged for a device that does not exist', async () => {
	const stranger = (await newIdentity()).id;
	const ack = await command(socket, { type: 'device-revoke', deviceId: stranger });
	expect(ack).toMatchObject({ ok: true });
});

test('a revocation voids an approval that was not exchanged yet', async () => {
	const request = await requestPairing(relay, host, socket);
	const deviceId = (await newIdentity()).id;
	const approval = {
		type: 'pairing-approve',
		pairingId: request.pairingId,
		deviceId,
		sealed: sealedText(),
		challenge: request.body.challenge
	};
	expect(await command(socket, approval)).toMatchObject({ ok: true });
	expect(await command(socket, { type: 'device-revoke', deviceId })).toMatchObject({ ok: true });
	const exchange = await relay.post(pairingPath(host, request.pairingId, 'exchange'), {
		verifier: request.verifier
	});
	expect([exchange.status, await exchange.json()]).toEqual([400, { error: 'pairing-invalid' }]);
	expect(await deviceIds()).not.toContain(deviceId);
});
