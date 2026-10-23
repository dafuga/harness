import type { Peer } from './device-connection.test.types';
import { expect, test } from 'vitest';
import { DeviceConnectionService } from '../../src/services/DeviceConnectionService';
import type { DeviceStatus } from '../../src/services/DeviceConnectionService';
import { hostPeer } from '../support/hostPeer';
function connection(peer: Peer) {
	const opened: { url: string; headers: Record<string, string> }[] = [],
		states: DeviceStatus[] = [];
	const service = new DeviceConnectionService({
		credentials: peer.credentials,
		client: { kind: 'test', name: 'fixture' },
		handshakeMs: 200,
		open: (url, headers) => {
			opened.push({ url, headers });
			return peer.pipe.socket;
		}
	});
	service.onStatus((state) => states.push(state));
	return { service, opened, states };
}

test('connecting authenticates by header, completes the handshake and attaches', async () => {
	const peer = await hostPeer(),
		{ service, opened, states } = connection(peer),
		{ credential } = peer.credentials;
	expect((await service.connect()).role).toBe('device');
	expect(opened).toEqual([
		{
			url: `wss://relay.example/v1/hosts/${peer.hostId}/connect`,
			headers: {
				Authorization: `Bearer ${credential}`,
				'X-Harness-Role': 'device',
				'X-Harness-Device': peer.deviceId
			}
		}
	]);
	expect(await service.wire.request('snapshot', { projectId: 'p' })).toEqual({
		echo: { projectId: 'p' }
	});
	const wire = peer.pipe.fromDevice.join('\n');
	expect(wire).not.toContain('snapshot');
	expect(wire).not.toContain(credential);
	expect(states).toEqual(['online']);
});
test('host events arrive through the sealed channel', async () => {
	const peer = await hostPeer(),
		{ service } = connection(peer),
		seen: unknown[] = [];
	await service.connect();
	service.wire.on('run', (value) => seen.push(value));
	peer.session.emit('run', { kind: 'text', text: 'hi' });
	await expect.poll(() => seen).toEqual([{ kind: 'text', text: 'hi' }]);
});
test('a host that went offline is offline until it returns, then the session resumes', async () => {
	const peer = await hostPeer(),
		{ service, states } = connection(peer);
	await service.connect();
	peer.pipe.toDevice(JSON.stringify({ type: 'relay', event: 'host-offline' }));
	await expect(service.wire.request('snapshot')).rejects.toMatchObject({ code: 'offline' });
	peer.pipe.toDevice(JSON.stringify({ type: 'relay', event: 'host-online' }));
	await expect.poll(() => states.at(-1)).toBe('online');
	expect(states).toEqual(['online', 'offline', 'online']);
	expect(await service.wire.request('snapshot', { n: 2 })).toEqual({ echo: { n: 2 } });
});
test('a closed socket is offline and close 4401 is revoked', async () => {
	const lost = await hostPeer(),
		first = connection(lost);
	await first.service.connect();
	lost.pipe.drop(1006);
	expect(first.states.at(-1)).toBe('offline');
	const revoked = await hostPeer(),
		second = connection(revoked);
	await second.service.connect();
	revoked.pipe.drop(4401);
	expect(second.states.at(-1)).toBe('revoked');
	await expect(second.service.wire.request('snapshot')).rejects.toMatchObject({ code: 'offline' });
});
test('a host reject ends the attempt as revoked', async () => {
	const peer = await hostPeer({ reject: true }),
		{ service, states } = connection(peer);
	await expect(service.connect()).rejects.toThrow();
	expect(states).toEqual(['revoked']);
});
test('a packet that fails the channel closes the socket instead of being processed', async () => {
	const peer = await hostPeer(),
		{ service, states } = connection(peer),
		seen: unknown[] = [];
	await service.connect();
	service.wire.on('run', (value) => seen.push(value));
	const forged = { type: 'sealed', counter: 99, more: false, data: 'A'.repeat(64) };
	peer.pipe.toDevice(JSON.stringify(forged));
	await expect.poll(() => peer.pipe.closes).toEqual([4400]);
	expect(states.at(-1)).toBe('offline');
	expect(seen).toEqual([]);
});
test('a handshake that gets no answer times out as offline', async () => {
	const peer = await hostPeer(),
		{ service, states } = connection(peer);
	peer.pipe.onDevice(() => {});
	await expect(service.connect()).rejects.toThrow();
	expect(states).toEqual(['offline']);
});
