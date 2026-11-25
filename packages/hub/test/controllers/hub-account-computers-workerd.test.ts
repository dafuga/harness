import { afterAll, beforeAll, expect, test } from 'vitest';
import WebSocket from 'ws';
import { hostFixture } from '../../../desktop/test/remote-host-fixture';
import { RelaySocketAdapter } from '../../../desktop/src/adapters/networking-security/RelaySocketAdapter';
import type { HeaderSocketConstructor } from '../../../desktop/src/adapters/networking-security/RelaySocketAdapter.types';
import { RemoteHostService } from '../../../desktop/src/services/networking-security/remote-host-service/RemoteHostService';
import type { RemoteHostRegistration, RemoteSocket } from '../../../remote/src/index';
import { DeviceConnectionService, DevicePairingService, randomId } from '../../../remote/src/index';
import { startHubRelay, type HubRelayFixture } from '../support/hubRelayFixture';

let fixture: HubRelayFixture;
beforeAll(async () => {
	fixture = await startHubRelay();
}, 120_000);
afterAll(async () => fixture?.stop());

const native = 'session-owner';
const browser = 'session-browser';
const other = 'session-other';
const actor = 'google:fixture-owner';

function relaySocket() {
	const transport = new RelaySocketAdapter({
		socket: WebSocket as unknown as HeaderSocketConstructor
	});
	return (url: string, headers: Record<string, string>) =>
		transport.open(fixture.relay.socketOrigin + new URL(url).pathname, headers);
}

async function mac(name: string) {
	const f = await hostFixture();
	const host = new RemoteHostService(
		f.options({
			accountOnly: true,
			name: () => name,
			register: async (body, ownerId) => {
				expect(ownerId).toBe(actor);
				const response = await fixture.hub(native, 'POST', '/hosts', {
					...body,
					accountLinked: true
				});
				expect(response.status).toBe(201);
				return (await response.json()) as RemoteHostRegistration;
			},
			open: relaySocket(),
			unregister: async (hostId) => {
				expect((await fixture.hub(native, 'DELETE', `/hosts/${hostId}`)).status).toBe(200);
			}
		})
	);
	await host.start();
	expect((await host.status()).host).toBeNull();
	host.linkAccount(actor);
	await f.online(host);
	return { host, hostId: host.current().state.hostId, project: f.project };
}

async function link(hostId: string, session: string, platform: 'web' | 'ios') {
	const host = `/hosts/${hostId}`;
	const path = host + '/pairing';
	const info = (await (await fixture.hub(session, 'GET', path)).json()) as {
		hostId: string;
		hostKey: string;
		origin: string;
	};
	const pairingId = randomId();
	const exchange = path + '/' + pairingId;
	const send = (operation: string, body: unknown) =>
		platform === 'web'
			? fixture.hub(session, 'POST', exchange + '/' + operation, body)
			: fixture.relay.post(`/v1/hosts/${hostId}/pairings/${pairingId}/${operation}`, body);
	const service = new DevicePairingService({
		fetch: (async (url, init) =>
			send(
				new URL(String(url)).pathname.split('/').at(-1)!,
				JSON.parse(String(init?.body))
			)) as typeof fetch
	});
	const input = { ...info, pairingId, code: '', deviceName: 'Fixture device', platform };
	const pending = await service.requestAccount(input, info.hostKey, async (proof) => {
		expect((await fixture.hub(other, 'POST', path, { pairingId, ...proof })).status).toBe(403);
		expect((await fixture.hub(null, 'POST', path, { pairingId, ...proof })).status).toBe(401);
		expect((await fixture.hub(session, 'POST', path, { pairingId, ...proof })).status).toBe(202);
	});
	expect(
		(
			await fixture.hub('session-browser-second', 'POST', exchange + '/exchange', {
				verifier: pending.verifier
			})
		).status
	).toBe(403);
	await expect.poll(() => service.poll(pending)).toBe('approved');
	return { credentials: await service.exchange(pending), exchange };
}

function accepted(reply: Response): RemoteSocket {
	expect(reply.status).toBe(101);
	const socket = (reply as Response & { webSocket?: globalThis.WebSocket & { accept(): void } })
		.webSocket!;
	socket.accept();
	return {
		opened: Promise.resolve(),
		send: (text) => socket.send(text),
		close: (code) => socket.close(code),
		onMessage: (listener) =>
			socket.addEventListener('message', (event) => listener(String(event.data))),
		onClose: (listener) => socket.addEventListener('close', (event) => listener(event.code))
	};
}

test('verified account links two Macs and securely opens browser and phone projects without approval', async () => {
	const desk = await mac('Desk Mac');
	const studio = await mac('Studio Mac');
	try {
		const discovered = await fixture.hub(browser, 'GET', '/hosts?linked=1');
		expect(await discovered.json()).toMatchObject({
			computers: expect.arrayContaining([
				{ hostId: desk.hostId, name: 'Desk Mac', online: true },
				{ hostId: studio.hostId, name: 'Studio Mac', online: true }
			])
		});
		expect(await (await fixture.hub(other, 'GET', '/hosts?linked=1')).json()).toEqual({
			computers: []
		});
		expect((await fixture.hub(other, 'GET', `/hosts/${desk.hostId}/pairing`)).status).toBe(403);

		const deskLink = await link(desk.hostId, browser, 'web');
		expect(deskLink.credentials.grant).toEqual({
			projects: [{ id: desk.project.id, name: desk.project.name }],
			comments: false,
			agents: false
		});
		const path = `/hosts/${desk.hostId}/connect/${deskLink.credentials.deviceId}`;
		expect((await fixture.hub(other, 'GET', path)).status).toBe(403);
		expect((await fixture.hub('session-browser-second', 'GET', path)).status).toBe(403);
		const ws = accepted(await fixture.hub(browser, 'GET', path));
		const connection = new DeviceConnectionService({
			credentials: deskLink.credentials,
			client: { kind: 'web', name: 'Fixture browser' },
			open: () => ws
		});
		const states: string[] = [];
		connection.onStatus((state) => states.push(state));
		try {
			const attached = await connection.connect();
			expect(attached.methods).not.toContain('startRun');
			expect(attached.methods).not.toContain('addComment');
			expect(await connection.wire.request('listProjects')).toMatchObject([
				{ id: desk.project.id }
			]);
			await expect(connection.wire.request('startRun')).rejects.toThrow();
			expect(
				(
					await fixture.hub(browser, 'POST', deskLink.exchange + '/exchange', {
						verifier: 'a'.repeat(43)
					})
				).status
			).toBe(403);
			await desk.host.devices.revokeDevice({ deviceId: deskLink.credentials.deviceId });
			await expect.poll(() => states.at(-1)).toBe('revoked');
			expect((await fixture.hub(browser, 'GET', path)).status).toBe(403);
		} finally {
			connection.close();
			connection.wire.close();
		}

		const phone = await link(studio.hostId, native, 'ios');
		const iPhone = new DeviceConnectionService({
			credentials: phone.credentials,
			client: { kind: 'ios', name: 'Fixture iPhone' },
			open: relaySocket()
		});
		try {
			const attached = await iPhone.connect();
			expect(attached.grant?.projects).toEqual([
				{ id: studio.project.id, name: studio.project.name }
			]);
			expect(await iPhone.wire.request('listProjects')).toMatchObject([{ id: studio.project.id }]);
			expect((await studio.host.status()).requests).toEqual([]);
			expect((await fixture.hub(browser, 'DELETE', `/hosts/${studio.hostId}`)).status).toBe(200);
			await expect.poll(async () => (await studio.host.status()).state).toBe('disabled');
		} finally {
			iPhone.close();
			iPhone.wire.close();
		}
		const remaining = await (await fixture.hub(browser, 'GET', '/hosts?linked=1')).json();
		expect(remaining).toEqual({
			computers: [{ hostId: desk.hostId, name: 'Desk Mac', online: true }]
		});
	} finally {
		await desk.host.stop();
		await studio.host.stop();
	}
}, 60_000);
