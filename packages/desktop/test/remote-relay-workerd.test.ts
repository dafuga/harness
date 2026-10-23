import type { Fixture } from './remote-relay-workerd.test.types';
import { expect } from '../../../test/verificationExpect';
import { afterAll, beforeAll, test } from 'vitest';
import { startRelay } from '../../relay/test/support/relayFixture';
import type { RelayFixture } from '../../relay/test/support/relayFixture';
import { DeviceConnectionService, DevicePairingService } from '../../remote/src/index';
import type {
	DeviceCredentials,
	DeviceStatus,
	RelayRegistered,
	RemoteHostRegisterInput
} from '../../remote/src/index';
import { RelaySocketAdapter } from '../src/adapters/RelaySocketAdapter';
import type { ProjectSnapshot } from '../src/models/Desktop.types';
import type { RunEvent } from '../src/models/DesktopBridge.types';
import { RemoteHostService } from '../src/services/remote-host-service/RemoteHostService';
import { deferred } from './remote-fixture';
import { hostFixture } from './remote-host-fixture';

/** The real relay Worker and its Durable Object in workerd, reached over real sockets. */
let relay: RelayFixture;
const sockets = new RelaySocketAdapter(),
	open = (url: string, headers: Record<string, string>) => sockets.open(url, headers),
	settle = { timeout: 20000 },
	owner = { id: 'google:fixture-owner' };
beforeAll(async () => {
	relay = await startRelay();
}, 120000);
afterAll(async () => {
	await relay?.stop();
});

/** What the hub does: it names the verified owner and reaches the object through its binding. */
async function register(input: RemoteHostRegisterInput) {
	const response = await relay.manage('register', { owner, ...input });
	if (!response.ok) throw new Error('The relay refused the registration.');
	return { ...((await response.json()) as RelayRegistered), origin: relay.origin };
}
async function computer(f: Fixture) {
	const host = new RemoteHostService(f.options({ register, open, link: { retryMs: [100] } }));
	await host.enable();
	await f.online(host);
	return host;
}
function phoneOf(credentials: DeviceCredentials) {
	const states: DeviceStatus[] = [],
		client = { kind: 'test' as const, name: 'fixture' },
		connection = new DeviceConnectionService({ credentials, client, open });
	connection.onStatus((state) => states.push(state));
	return { connection, states, wire: connection.wire };
}
async function paired(f: Fixture, host: RemoteHostService) {
	const offer = await host.devices.createPairing(),
		pairing = new DevicePairingService(),
		pending = await pairing.request({ ...offer, deviceName: 'Fixture phone', platform: 'test' });
	await expect.poll(async () => (await host.status()).requests.length, settle).toBe(1);
	await host.devices.approvePairing({
		deviceId: pending.deviceId,
		pairingId: offer.pairingId,
		projectIds: [f.project.id],
		agents: true
	});
	const credentials = await pairing.exchange(pending);
	return { offer, credentials, ...phoneOf(credentials) };
}

test('a phone pairs, reads, runs and is revoked through the relay, which never holds plaintext', async () => {
	const gate = deferred(),
		f = await hostFixture(() => gate.promise),
		events: RunEvent[] = [];
	const denied = await relay.post('/manage/register', { owner, hostId: 'a'.repeat(40) });
	expect(denied.status).toBe(404);
	const host = await computer(f);
	try {
		const phone = await paired(f, host),
			{ offer, credentials } = phone,
			projectId = f.project.id;
		expect(offer.origin).toBe(relay.origin);
		expect(await phone.connection.connect()).toMatchObject({
			role: 'device',
			host: { id: offer.hostId, name: 'Fixture Mac' },
			grant: { projects: [{ id: projectId }], agents: true }
		});
		const view = { projectId, branch: null, commit: null },
			snapshot = await phone.wire.request<ProjectSnapshot>('snapshot', view);
		expect(snapshot.project).toEqual({ name: f.project.name, root: '', id: projectId });
		phone.wire.on('run', (event) => events.push(event as RunEvent));
		const { runId } = await phone.wire.request<{ runId: string }>('startRun', f.start());
		await expect.poll(() => f.run.mock.calls.length, settle).toBe(1);
		await expect.poll(() => events.length, settle).toBeGreaterThan(0);
		expect(events.every((event) => event.runId === runId)).toBe(true);
		const stored = JSON.stringify(await relay.rows(offer.hostId)),
			secrets = [credentials.credential, offer.code.replace('-', ''), 'Fixture phone'];
		for (const secret of [...secrets, f.project.name, f.request.text, f.root])
			expect(stored).not.toContain(secret);
		expect(stored).toContain(credentials.deviceId);
		const status = await host.devices.revokeDevice({ deviceId: credentials.deviceId });
		expect(status.devices).toEqual([]);
		expect(f.run.mock.calls[0][0].signal.aborted).toBe(true);
		await expect.poll(() => phone.states.at(-1), settle).toBe('revoked');
		await expect(phoneOf(credentials).connection.connect()).rejects.toThrow();
	} finally {
		gate.resolve();
		await host.stop();
	}
	await expect.poll(() => f.arbiter.held(f.root), settle).toBe(false);
}, 120000);

test('suspension is offline at the relay; waking resumes the same session over a new channel', async () => {
	const f = await hostFixture(),
		host = await computer(f);
	try {
		const phone = await paired(f, host);
		await phone.connection.connect();
		host.suspend();
		await expect.poll(() => phone.states.at(-1), settle).toBe('offline');
		expect((await host.status()).state).toBe('offline');
		await expect(phone.wire.request('listProjects')).rejects.toMatchObject({ code: 'offline' });
		host.resume();
		await f.online(host);
		await expect.poll(() => phone.states.at(-1), settle).toBe('online');
		expect(await phone.wire.request('listProjects')).toHaveLength(1);
		expect(phone.states).toEqual(['online', 'offline', 'online']);
		phone.connection.close();
	} finally {
		await host.stop();
	}
}, 120000);
