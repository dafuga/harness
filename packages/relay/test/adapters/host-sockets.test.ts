import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	connectDevice,
	connectHost,
	openDevice,
	ownerOf,
	pairDevice,
	registerHost,
	type TestDevice,
	type TestHost
} from '../support/relayActors';
import { startRelay, type RelayFixture } from '../support/relayFixture';
import type { RelaySocket } from '../support/relaySocket';

interface Summary {
	online: boolean;
	devices: { deviceId: string; online: boolean; createdAt: string; lastSeenAt: string | null }[];
}
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

async function summary(host: TestHost): Promise<Summary> {
	return (await (await relay.manage('summary', ownerOf(host))).json()) as Summary;
}

test('a newer host socket replaces the older one', async () => {
	const { host, socket: first, device } = await paired();
	const phone = await connectDevice(relay, host, device);
	await first.until('device-open');
	const second = await connectHost(relay, host);
	expect((await first.closed).code).toBe(4409);
	expect(await phone.drain()).toEqual([{ type: 'relay', event: 'host-online' }]);
	expect((await summary(host)).online).toBe(true);
	expect(await second.until('device-open')).toMatchObject({ deviceId: device.deviceId });
	phone.close();
	second.close();
});

test('a newer socket of a device replaces the older one and the host follows', async () => {
	const { host, socket, device } = await paired();
	const first = await openDevice(relay, host, { device, socket });
	const second = await connectDevice(relay, host, device);
	expect((await first.socket.closed).code).toBe(4409);
	const closed = await socket.next();
	expect(closed).toEqual({
		type: 'device-close',
		deviceId: device.deviceId,
		connectionId: first.connectionId
	});
	const opened = await socket.next();
	expect(opened).toMatchObject({ type: 'device-open', deviceId: device.deviceId });
	expect(opened.connectionId).toMatch(/^[a-f0-9]{32}$/);
	expect(opened.connectionId).not.toBe(first.connectionId);
	expect(await socket.drain()).toEqual([]);
	second.close();
	socket.close();
});

test('two devices of one host are connected side by side', async () => {
	const { host, socket, device } = await paired();
	const other = await pairDevice(relay, host, socket);
	const first = await openDevice(relay, host, { device, socket });
	const second = await openDevice(relay, host, { device: other, socket });
	expect(first.connectionId).not.toBe(second.connectionId);
	const devices = (await summary(host)).devices;
	expect(devices.map((item) => item.online)).toEqual([true, true]);
	first.socket.close();
	await first.socket.closed;
	expect(await socket.next()).toEqual({
		type: 'device-close',
		deviceId: device.deviceId,
		connectionId: first.connectionId
	});
	const after = await summary(host);
	expect(after.devices.find((item) => item.deviceId === device.deviceId)?.online).toBe(false);
	expect(after.devices.find((item) => item.deviceId === other.deviceId)?.online).toBe(true);
	second.socket.close();
	socket.close();
});

test('the summary says who is online and when a device was last seen', async () => {
	const { host, socket, device } = await paired();
	const before = await summary(host);
	expect(before.online).toBe(true);
	expect(before.devices).toEqual([
		{
			deviceId: device.deviceId,
			online: false,
			createdAt: before.devices[0].createdAt,
			lastSeenAt: null
		}
	]);
	expect(new Date(before.devices[0].createdAt).toISOString()).toBe(before.devices[0].createdAt);
	const phone = await openDevice(relay, host, { device, socket });
	const during = await summary(host);
	expect(during.devices[0].online).toBe(true);
	expect(Date.parse(String(during.devices[0].lastSeenAt))).toBeGreaterThan(Date.now() - 10_000);
	phone.socket.close();
	socket.close();
	await Promise.all([phone.socket.closed, socket.closed]);
	const after = await summary(host);
	expect(after.online).toBe(false);
	expect(after.devices[0].online).toBe(false);
	expect(after.devices[0].lastSeenAt).not.toBeNull();
});
