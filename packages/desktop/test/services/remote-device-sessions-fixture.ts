import type { Side } from './remote-device-sessions.test.types';
import { expect } from 'vitest';
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
export const writeToken = 'synthetic-fixture-write-token-0002';

export async function setup(trackerEnabled = false, writeEnabled = false, vaultEnabled = false) {
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
			vaultPhone: vaultEnabled
				? {
						phone: deviceId,
						generation: 1,
						origin: 'https://vault.example.test',
						deviceId: 'fixture-iphone',
						socketPath: '/tmp/synthetic-vault-broker.sock'
					}
				: undefined,
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
