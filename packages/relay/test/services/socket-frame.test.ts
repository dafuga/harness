import type { Scene } from './socket-frame.test.types';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { remoteLimits } from '../../../remote/src/index';
import { relayConfig } from '../../src/configs/relayConfig';
import { connectHost, openDevice, pairDevice, registerHost } from '../support/relayActors';
import { startRelay, type RelayFixture } from '../support/relayFixture';
import { acceptPacket, sealedPacket } from '../support/relayPackets';
import type { RelaySocket } from '../support/relaySocket';
let relay: RelayFixture;

beforeAll(async () => {
	relay = await startRelay();
}, 60_000);
afterAll(() => relay.stop());

/** A host of its own with one phone connected, so that a closed socket harms no other test. */
async function scene(): Promise<Scene> {
	const host = await registerHost(relay);
	const socket = await connectHost(relay, host);
	const device = await pairDevice(relay, host, socket);
	const opened = await openDevice(relay, host, { device, socket });
	return { host, socket, device, phone: opened.socket, connectionId: opened.connectionId };
}

async function closeCode(send: (target: Scene) => RelaySocket): Promise<number> {
	const target = await scene();
	return (await send(target).closed).code;
}

test('ping is answered pong for a device and for a host', async () => {
	const { socket, phone } = await scene();
	phone.send('ping');
	expect(await phone.text()).toBe('pong');
	socket.send('ping');
	expect(await socket.text()).toBe('pong');
	expect(await socket.drain()).toEqual([]);
});

test('a frame of the contract size passes and one byte more closes the socket with 4413', async () => {
	const { socket, phone, device, connectionId } = await scene();
	const frame = sealedPacket(0, 64);
	const padding = remoteLimits.frameBytes - JSON.stringify(frame).length;
	phone.send(JSON.stringify(frame) + ' '.repeat(padding));
	expect(await socket.next()).toEqual({
		type: 'packet',
		deviceId: device.deviceId,
		connectionId,
		packet: frame
	});
	phone.send(JSON.stringify(frame) + ' '.repeat(padding + 1));
	expect((await phone.closed).code).toBe(4413);
	expect(await socket.drain()).toEqual([
		{ type: 'device-close', deviceId: device.deviceId, connectionId }
	]);
});

test('an oversize frame of the host closes the host socket with 4413', async () => {
	const code = await closeCode(({ socket }) => {
		socket.send('x'.repeat(remoteLimits.frameBytes + 1));
		return socket;
	});
	expect(code).toBe(4413);
});

test('a device frame that is not JSON, not a packet or not for a device to send closes with 4400', async () => {
	const accept = JSON.stringify(await acceptPacket());
	const frames = [
		'{',
		'pong',
		'null',
		'[]',
		'{"type":"nope"}',
		'{"type":"sealed","counter":0,"more":false}',
		JSON.stringify({ ...sealedPacket(0), extra: true }),
		JSON.stringify({ type: 'reject', reason: 'busy' }),
		JSON.stringify({
			type: 'pairing-open',
			ref: 'r',
			pairingId: 'e6'.repeat(16),
			expiresAt: '2030-01-01'
		}),
		accept
	];
	for (const frame of frames) {
		const target = await scene();
		target.phone.send(frame);
		expect((await target.phone.closed).code, frame).toBe(4400);
		expect(await target.socket.drain(), frame).toEqual([
			{ type: 'device-close', deviceId: target.device.deviceId, connectionId: target.connectionId }
		]);
	}
});

test('a host frame that is not JSON or not a command closes with 4400', async () => {
	const frames = [
		'{',
		'null',
		'{"type":"nope"}',
		'{"type":"ready","hostId":"x","devices":[]}',
		'{"type":"pairing-deny","ref":"r"}',
		JSON.stringify(sealedPacket(0))
	];
	for (const frame of frames) {
		const target = await scene();
		target.socket.send(frame);
		expect((await target.socket.closed).code, frame).toBe(4400);
		expect(await target.phone.next()).toEqual({ type: 'relay', event: 'host-offline' });
	}
});

test('a binary frame closes with 4400', async () => {
	const bytes = new TextEncoder().encode(JSON.stringify(sealedPacket(0)));
	expect(
		await closeCode(({ phone }) => {
			phone.send(bytes);
			return phone;
		})
	).toBe(4400);
	expect(
		await closeCode(({ socket }) => {
			socket.send(bytes);
			return socket;
		})
	).toBe(4400);
});

test('a device that floods the relay is closed with 4429', async () => {
	const { socket, phone, device, connectionId } = await scene();
	const frame = JSON.stringify(sealedPacket(0));
	for (let sent = 0; sent <= relayConfig.deviceFrames; sent += 1) phone.send(frame);
	expect((await phone.closed).code).toBe(4429);
	const frames = (await socket.drain(500)) as { type: string }[];
	expect(frames.filter((item) => item.type === 'packet')).toHaveLength(relayConfig.deviceFrames);
	expect(frames.at(-1)).toEqual({ type: 'device-close', deviceId: device.deviceId, connectionId });
});
