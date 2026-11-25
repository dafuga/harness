import { afterEach } from 'vitest';
import { expect } from '../../../test/verificationExpect';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DeviceConnectionService } from '../../remote/src/index';
import type { DeviceCredentials, DeviceStatus } from '../../remote/src/index';
import { RemoteHostStoreAdapter } from '../src/adapters/networking-security/RemoteHostStoreAdapter';
import type { AgentTurn } from '../src/models/agents-providers/AgentRunner.types';
import { CommentOutboxService } from '../src/services/projects-sessions/CommentOutboxService';
import { RemoteHostService } from '../src/services/networking-security/remote-host-service/RemoteHostService';
import type { RemoteHostOptions } from '../src/services/networking-security/remote-host-service/RemoteHostService';
import { remoteFixture } from './remote-fixture';
import { MemoryRelay } from './remote-relay-fixture';
import { accountPairing, memoryTarget } from './remote-account-pairing';

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
	const { registry, arbiter, providers, renderMockups } = f;
	const options = (overrides: Partial<RemoteHostOptions> = {}): RemoteHostOptions => ({
		store: storeFor(),
		register: relay.register,
		open: relay.open,
		shared: { registry, arbiter, providers, renderMockups, outbox: new CommentOutboxService() },
		name: () => 'Fixture Mac',
		link: { retryMs: [10] },
		...overrides
	});
	const host = new RemoteHostService(options());
	const state = async (target = host) => (await target.status()).state;
	const online = (target = host) =>
		expect.poll(() => state(target), { timeout: 5000 }).toBe('online');
	/** A signed-in phone asks: its sealed request reaches the host through the relay. */
	const ask = async (target = host, name = 'Fixture phone') =>
		accountPairing(await memoryTarget(relay, target), name);
	/** The signed-in phone asks; the person approves; the phone exchanges once. */
	async function pair(grant = { projectIds: [f.project.id], agents: true }, target = host) {
		const { pairing, pending, pairingId } = await ask(target);
		await expect.poll(async () => (await target.status()).requests.length).toBe(1);
		const { deviceId } = pending;
		await target.devices.approvePairing({ pairingId, deviceId, ...grant });
		return {
			offer: { pairingId, hostId: pending.input.hostId },
			credentials: await pairing.exchange(pending)
		};
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
	return { ...f, relay, file, storeFor, options, host, state, online, ask, pair, phone };
}
