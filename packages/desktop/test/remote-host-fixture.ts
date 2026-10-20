import { afterEach } from 'vitest';
import { expect } from '../../../test/verificationExpect';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DeviceConnectionService, DevicePairingService } from '../../remote/src/index';
import type { DeviceCredentials, DeviceStatus } from '../../remote/src/index';
import { RemoteHostStoreAdapter } from '../src/adapters/RemoteHostStoreAdapter';
import type { AgentTurn } from '../src/models/AgentRunner.types';
import { CommentOutboxService } from '../src/services/CommentOutboxService';
import { RemoteHostService } from '../src/services/remote-host-service/RemoteHostService';
import type { RemoteHostOptions } from '../src/services/remote-host-service/RemoteHostService';
import { remoteFixture } from './remote-fixture';
import { MemoryRelay } from './remote-relay-fixture';

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
export const fakeEncryption = (available = true) => ({
	isEncryptionAvailable: () => available,
	encryptString: (value: string) => Buffer.from('sealed:' + Buffer.from(value).toString('hex')),
	decryptString: (value: Buffer) => Buffer.from(value.toString().slice(7), 'hex').toString()
});
/** A computer with one project, a relay in memory, and phones that follow the device contract. */
export async function hostFixture(action: (turn: AgentTurn) => Promise<void> = async () => {}) {
	const f = await remoteFixture(action),
		relay = new MemoryRelay(),
		root = await mkdtemp(join(tmpdir(), 'harness-remote-host-'));
	roots.push(root);
	const file = join(root, 'remote.enc');
	const storeFor = (available = true) =>
		new RemoteHostStoreAdapter({ file, encryption: fakeEncryption(available), platform: 'darwin' });
	const { registry, arbiter, providers, generator } = f;
	const options = (overrides: Partial<RemoteHostOptions> = {}): RemoteHostOptions => ({
		store: storeFor(),
		register: relay.register,
		open: relay.open,
		shared: { registry, arbiter, providers, generator, outbox: new CommentOutboxService() },
		name: () => 'Fixture Mac',
		link: { retryMs: [10] },
		...overrides
	});
	const host = new RemoteHostService(options());
	const state = async (target = host) => (await target.status()).state;
	const online = (target = host) =>
		expect.poll(() => state(target), { timeout: 5000 }).toBe('online');
	/** The phone asks with the code; the person approves; the phone exchanges once. */
	async function pair(grant = { projectIds: [f.project.id], agents: true }, target = host) {
		const offer = await target.devices.createPairing(),
			pairing = new DevicePairingService({ fetch: relay.fetch });
		const pending = await pairing.request({
			...offer,
			deviceName: 'Fixture phone',
			platform: 'test'
		});
		await expect.poll(async () => (await target.status()).requests.length).toBe(1);
		const { pairingId } = offer,
			{ deviceId } = pending;
		await target.devices.approvePairing({ pairingId, deviceId, ...grant });
		return { offer, credentials: await pairing.exchange(pending) };
	}
	function phone(credentials: DeviceCredentials) {
		const states: DeviceStatus[] = [];
		const connection = new DeviceConnectionService({
			credentials,
			client: { kind: 'test', name: 'fixture' },
			handshakeMs: 3000,
			open: relay.open
		});
		connection.onStatus((status) => states.push(status));
		return { connection, states, client: connection.wire };
	}
	return { ...f, relay, file, storeFor, options, host, state, online, pair, phone };
}
