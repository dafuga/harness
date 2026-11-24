import type { Side } from './remote-device-sessions.test.types';
import { expect, test } from 'vitest';
import {
	SecureChannelService,
	WireClientService,
	randomId,
	remoteIdentity,
	remoteKeys,
	toBase64Url
} from '../../../remote/src/index';
import type { RemoteKeyPair, SecurePacket } from '../../../remote/src/index';
import type { RemoteHostDevice } from '../../src/adapters/networking-security/RemoteHostStoreAdapter';
import { CommentOutboxService } from '../../src/services/projects-sessions/CommentOutboxService';
import { RemoteDeviceSessionsService } from '../../src/services/RemoteDeviceSessionsService';
import type { DeviceAddress } from '../../src/services/RemoteDeviceSessionsService';
import { remoteFixture } from '../remote-fixture';

const pause = (milliseconds = 0) => new Promise((resolve) => setTimeout(resolve, milliseconds));
/** The phone's end of one connection, with the keys it claims to hold. */
function phoneOf(side: Side, keys: RemoteKeyPair, deviceId: string) {
	const { sessions, hostId } = side,
		address = { deviceId, connectionId: randomId(16) },
		channel = new SecureChannelService({
			role: 'device',
			hostId,
			deviceId,
			staticKey: keys,
			peerKey: side.hostKey
		}),
		client = new WireClientService({ client: { kind: 'test', name: 'fixture' }, deadlineMs: 300 }),
		received: SecurePacket[] = [];
	const up = (packet: SecurePacket) => void sessions.packet(address, packet);
	side.inbox.set(address.connectionId, (packet) => {
		received.push(packet);
		if (packet.type === 'sealed')
			void channel.open(packet).then((text) => (text === null ? null : client.receive(text)));
	});
	async function handshake() {
		await sessions.packet(address, await channel.hello());
		const accept = received.find((packet) => packet.type === 'accept');
		if (accept) await channel.accept(accept);
		return accept;
	}
	const attach = async () => {
		await handshake();
		return client.bind((text) => void channel.seal(text, up));
	};
	return { address, client, received, handshake, attach };
}
const writeToken = 'synthetic-fixture-write-token-0002';

async function setup(trackerEnabled = false, writeEnabled = false) {
	const f = await remoteFixture(),
		hostKeys = await remoteKeys(),
		deviceKeys = await remoteKeys(),
		hostId = await remoteIdentity(hostKeys.publicKey),
		deviceId = await remoteIdentity(deviceKeys.publicKey);
	const record: RemoteHostDevice = {
		deviceId,
		deviceKey: toBase64Url(deviceKeys.publicKey),
		name: 'Fixture phone',
		platform: 'test',
		projects: [{ id: f.project.id, name: f.project.name }],
		agents: true,
		approvedAt: '2026-10-12T10:00:00.000Z',
		generation: 1,
		lastSeenAt: null
	};
	const records = new Map([[deviceId, record]]),
		sent: { address: DeviceAddress; packet: SecurePacket }[] = [],
		drops: { address: DeviceAddress; code: number }[] = [],
		inbox = new Map<string, (packet: SecurePacket) => void>();
	const { registry, arbiter, providers, renderMockups } = f;
	const trackerRequests: URL[] = [];
	const trackerFetcher = async (input: URL | string | Request, init?: RequestInit) => {
		const url = new URL(String(input));
		trackerRequests.push(url);
		if (url.pathname.endsWith('/write')) {
			const headers = new Headers(init?.headers);
			expect(headers.get('authorization')).toBe('Bearer ' + writeToken);
			expect(headers.get('x-tracker-phone-device')).toBe(deviceId);
			expect(headers.get('x-tracker-phone-scope')).toMatch(/^[a-f0-9]{64}$/);
			expect(url.search).toBe('');
			const { intentId } = JSON.parse(String(init?.body));
			return Response.json({ intentId, status: 'accepted' });
		}
		return Response.json({ kind: 'snapshot', rows: [], continuation: null, cursor: 'fixture' });
	};
	const sessions = new RemoteDeviceSessionsService({
		shared: {
			registry,
			arbiter,
			providers,
			renderMockups,
			outbox: new CommentOutboxService(),
			...(trackerEnabled ? { trackerPhone: deviceId, trackerFetcher } : {}),
			...(writeEnabled ? { trackerWrite: { device: deviceId, token: writeToken } } : {})
		},
		host: () => ({ id: hostId, name: 'Fixture Mac', keys: hostKeys }),
		device: (id) => records.get(id) ?? null,
		send: (address, packet) => {
			sent.push({ address, packet });
			inbox.get(address.connectionId)?.(packet);
		},
		drop: (address, code) => drops.push({ address, code })
	});

	const phone = (keys: RemoteKeyPair = deviceKeys, id = deviceId) =>
		phoneOf({ sessions, inbox, hostId, hostKey: hostKeys.publicKey }, keys, id);
	return { f, sessions, records, sent, drops, phone, deviceId, deviceKeys, trackerRequests };
}

test('an approved device completes the handshake and is served by its own session', async () => {
	const s = await setup(),
		phone = s.phone(),
		attachment = await phone.attach();
	expect(attachment).toMatchObject({
		role: 'device',
		device: { id: s.deviceId, name: 'Fixture phone' },
		host: { name: 'Fixture Mac' }
	});
	expect(await phone.client.request('listProjects')).toEqual([
		{ id: s.f.project.id, name: s.f.project.name, kind: 'local' }
	]);
	expect(s.sessions.connected(s.deviceId)).toBe(true);
	expect(JSON.stringify(s.sent)).not.toContain(s.f.project.name);
	expect(s.drops).toEqual([]);
}, 30000);
test('an unknown device is rejected before any key is derived', async () => {
	const s = await setup(),
		stranger = await remoteKeys(),
		phone = s.phone(stranger, await remoteIdentity(stranger.publicKey));
	expect(await phone.handshake()).toBeUndefined();
	expect(phone.received).toEqual([{ type: 'reject', reason: 'unknown-device' }]);
	expect(s.drops).toEqual([{ address: phone.address, code: 4401 }]);
}, 30000);
test('a device without the approved key is dropped at its first packet and gets no answer', async () => {
	const s = await setup(),
		phone = s.phone(await remoteKeys());
	await expect(phone.attach()).rejects.toMatchObject({ code: 'deadline' });
	expect(phone.received.map((packet) => packet.type)).toEqual(['accept']);
	expect(s.drops).toEqual([{ address: phone.address, code: 4400 }]);
	expect(s.sessions.connected(s.deviceId)).toBe(false);
}, 30000);
test('a newer connection of a device replaces the older one', async () => {
	const s = await setup(),
		first = s.phone(),
		second = s.phone();
	await first.attach();
	await second.attach();
	const before = first.received.length;
	expect(await second.client.request('listProjects')).toHaveLength(1);
	await first.client.request('listProjects').catch(() => undefined);
	expect(first.received).toHaveLength(before);
	expect(s.drops.at(-1)).toEqual({ address: first.address, code: 4400 });
}, 30000);
test('revocation ends the session: nothing more is answered and a new hello is rejected', async () => {
	const s = await setup(),
		phone = s.phone();
	await phone.attach();
	s.records.delete(s.deviceId);
	s.sessions.revoke(s.deviceId);
	const before = s.sent.length;
	await phone.client.request('listProjects').catch(() => undefined);
	await pause(20);
	expect(s.sent).toHaveLength(before);
	expect(s.sessions.connected(s.deviceId)).toBe(false);
	const again = s.phone();
	expect(await again.handshake()).toBeUndefined();
	expect(again.received).toEqual([{ type: 'reject', reason: 'unknown-device' }]);
}, 30000);

test('only the authorized paired phone can pull the local Tracker projection', async () => {
	const enabled = await setup(true);
	const allowed = enabled.phone();
	const attachment = await allowed.attach();
	expect(attachment.methods).toContain('trackerReplicaPull');
	const reply = await allowed.client.request('trackerReplicaPull', { version: 1 });
	expect(reply).toEqual({ kind: 'snapshot', rows: [], continuation: null, cursor: 'fixture' });
	expect(enabled.trackerRequests.map((url) => url.origin + url.pathname)).toEqual([
		'http://127.0.0.1:7701/phone-replica/v1'
	]);
	expect(enabled.trackerRequests[0].searchParams.get('scope')).toMatch(/^[a-f0-9]{64}$/);
	await expect(
		allowed.client.request('trackerReplicaPull', { version: 1, scope: 'caller' })
	).rejects.toMatchObject({ code: 'invalid-message' });
	expect(enabled.trackerRequests).toHaveLength(1);

	const disabled = await setup();
	const denied = disabled.phone();
	expect((await denied.attach()).methods).not.toContain('trackerReplicaPull');
	await expect(denied.client.request('trackerReplicaPull', { version: 1 })).rejects.toMatchObject({
		code: 'method-denied'
	});
	expect(disabled.trackerRequests).toEqual([]);
}, 30000);

test('keeps phone Tracker writes outside the paired read grant', async () => {
	const readOnly = await setup(true);
	const permitted = await setup(true, true);
	const denied = readOnly.phone(),
		writer = permitted.phone();
	expect((await denied.attach()).methods).not.toContain('trackerReplicaPush');
	expect((await writer.attach()).methods).toContain('trackerReplicaPush');
	await expect(writer.client.request('trackerInboxWrite', {})).rejects.toMatchObject({
		code: 'method-denied'
	});
	const intentId = '00000000-0000-4000-8000-000000000011';
	const input = { version: 1, intentId, itemId: 'fixture001', action: 'note', text: 'Fixture' };
	await expect(denied.client.request('trackerReplicaPush', input)).rejects.toMatchObject({
		code: 'method-denied'
	});
	expect(readOnly.trackerRequests).toHaveLength(0);
	expect(await writer.client.request('trackerReplicaPush', input)).toEqual({
		intentId,
		status: 'accepted'
	});
	expect(JSON.stringify(permitted.sent)).not.toContain(writeToken);
}, 30000);
