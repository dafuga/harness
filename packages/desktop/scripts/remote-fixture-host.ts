import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startRelay } from '../../relay/test/support/relayFixture';
import type { RelayRegistered, RemoteHostRegisterInput } from '../../remote/src/index';
import { RelaySocketAdapter } from '../src/adapters/RelaySocketAdapter';
import { RemoteHostStoreAdapter } from '../src/adapters/RemoteHostStoreAdapter';
import { CommentOutboxService } from '../src/services/CommentOutboxService';
import { ProjectRegistryService } from '../src/services/ProjectRegistryService';
import { ProviderDiscoveryService } from '../src/services/provider-discovery-service/ProviderDiscoveryService';
import { RemoteHostService } from '../src/services/remote-host-service/RemoteHostService';
import { RepositoryArbiterService } from '../src/services/RepositoryArbiterService';
import { remoteFixtureControl } from './remote-fixture-control';
import type { FixtureAction } from './remote-fixture-control';
import { fixtureProviders, remoteFixtureProject } from './remote-fixture-project';

export interface RemoteFixtureOptions {
	/** Fixed ports for a simulator to be pointed at; any free ones when 0 or omitted. */
	relayPort?: number;
	controlPort?: number;
	/** Where public facts of the fixture are written: addresses and ids, never a code or a key. */
	publicDirectory: string;
	log: (line: string) => void;
	/**
	 * Who approves a phone that asks. By default the fixture does, as it has no person at it;
	 * `asked` leaves every request waiting until the control is told to approve or deny it.
	 */
	approval?: 'automatic' | 'asked';
}
const owner = { id: 'fixture:synthetic-owner' };
const notice =
	'TEST ONLY: disposable relay and computer with a synthetic project. Not a deployment.';

/** State at rest is sealed with a key that exists only in this process and dies with it. */
function processEncryption() {
	const key = randomBytes(32);
	return {
		isEncryptionAvailable: () => true,
		encryptString: (value: string) => {
			const iv = randomBytes(12),
				cipher = createCipheriv('aes-256-gcm', key, iv),
				sealed = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
			return Buffer.concat([iv, cipher.getAuthTag(), sealed]);
		},
		decryptString: (value: Buffer) => {
			const decipher = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
			decipher.setAuthTag(value.subarray(12, 28));
			return decipher.update(value.subarray(28), undefined, 'utf8') + decipher.final('utf8');
		}
	};
}
/** A phone that proved the offer's code is approved for the synthetic project and nothing else. */
function autoApprove(host: RemoteHostService, projectId: string, log: (line: string) => void) {
	const seen = new Set<string>();
	host.onStatus(({ requests }) => {
		for (const { pairingId, deviceName, deviceId } of requests) {
			if (seen.has(pairingId)) continue;
			seen.add(pairingId);
			log(`Approving "${deviceName}" (${deviceId.slice(0, 8)}…): synthetic project, agents on.`);
			const grant = { pairingId, deviceId, projectIds: [projectId], agents: true };
			void host.devices.approvePairing(grant).catch(() => log('The approval was refused.'));
		}
	});
}

type Relay = Awaited<ReturnType<typeof startRelay>>;
interface Running {
	host: RemoteHostService;
	screen: { locked?: boolean };
	facts: { relayOrigin: string; hostId: string; project: { id: string; name: string } };
}
/** The real host service over a synthetic project, registered at the fixture relay. */
async function fixtureHost(relay: Relay, state: string, root: string) {
	const registry = new ProjectRegistryService(join(state, 'projects.json')),
		{ id, name } = await registry.register(root),
		{ generator, ...runners } = fixtureProviders(),
		sockets = new RelaySocketAdapter(),
		screen: { locked?: boolean } = {};
	const register = async (input: RemoteHostRegisterInput) => {
		const answer = await relay.manage('register', { owner, ...input });
		if (!answer.ok) throw new Error('The fixture relay refused the registration.');
		return { ...((await answer.json()) as RelayRegistered), origin: relay.origin };
	};
	const host = new RemoteHostService({
		store: new RemoteHostStoreAdapter({
			file: join(state, 'remote.enc'),
			encryption: processEncryption(),
			platform: 'darwin'
		}),
		register,
		open: (url, headers) => sockets.open(url, headers),
		shared: {
			registry,
			outbox: new CommentOutboxService(join(state, 'outbox.json')),
			arbiter: new RepositoryArbiterService(),
			providers: new ProviderDiscoveryService(runners),
			generator
		},
		name: () => 'Harness fixture computer',
		locked: () => screen.locked
	});
	return { host, screen, project: { id, name } };
}
/** Enabled and connected to the relay, or an error: a pairing needs the relay. */
async function online(host: RemoteHostService): Promise<string> {
	const enabled = await host.enable();
	for (let attempt = 0; attempt < 200; attempt++) {
		if ((await host.status()).state === 'online' && enabled.host) return enabled.host.id;
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	throw new Error('The fixture host did not reach the fixture relay.');
}
/** The person at the computer, stood in for by who runs the fixture: answers whoever waits. */
function decisions(running: Running, view: () => Promise<object>): Record<string, FixtureAction> {
	const { host, facts } = running,
		waiting = async () => (await host.status()).requests;
	return {
		'POST /approve': async (body) => {
			const grant = { projectIds: [facts.project.id], agents: body.agents !== false };
			for (const { pairingId, deviceId } of await waiting())
				await host.devices.approvePairing({ pairingId, deviceId, ...grant });
			return view();
		},
		'POST /deny': async () => {
			for (const { pairingId } of await waiting()) await host.devices.denyPairing({ pairingId });
			return view();
		}
	};
}
/** What the control answers: public facts and state. An offer is given once, to who asked for it. */
function fixtureActions(running: Running, options: RemoteFixtureOptions) {
	const { host, screen, facts } = running,
		save = (file: string, value: object) =>
			writeFile(
				join(options.publicDirectory, file),
				JSON.stringify({ notice, ...value }, null, '\t')
			);
	const view = async () => {
		const { state: reached, pairing, requests, devices } = await host.status(),
			offer = pairing && { ...pairing, code: undefined, scan: undefined };
		return { ...facts, state: reached, locked: screen.locked ?? null, offer, requests, devices };
	};
	const screened = (locked: boolean) => {
		screen.locked = locked;
		host.screen(locked);
		return view();
	};
	const actions: Record<string, FixtureAction> = {
		...decisions(running, view),
		'GET /status': view,
		'POST /pairing': async () => {
			const offer = await host.devices.createPairing();
			options.log(`Pairing offer ${offer.pairingId} is open until ${offer.expiresAt}.`);
			await save('offer.json', { ...offer, code: undefined, scan: undefined });
			return offer;
		},
		'POST /suspend': () => (host.suspend(), view()),
		'POST /resume': () => (host.resume(), view()),
		'POST /lock': () => screened(true),
		'POST /unlock': () => screened(false),
		'POST /revoke': async (body) => {
			const { devices } = await host.status(),
				named = devices.filter((device) => !body.deviceId || device.deviceId === body.deviceId);
			for (const { deviceId } of named) await host.devices.revokeDevice({ deviceId });
			return view();
		}
	};
	return { actions, save };
}

/**
 * TEST ONLY. A disposable computer for pairing a simulator: the real relay Worker in workerd,
 * the real RemoteHostService, a synthetic Git project and a stand-in CLI. It uses no hosted
 * account and no credential of anything real, and nothing of it leaves this machine.
 */
export async function startRemoteFixture(options: RemoteFixtureOptions) {
	const relay = await startRelay({ port: options.relayPort }),
		project = await remoteFixtureProject(),
		state = await mkdtemp(join(tmpdir(), 'harness-remote-fixture-state-')),
		built = await fixtureHost(relay, state, project.root);
	if (options.approval !== 'asked') autoApprove(built.host, built.project.id, options.log);
	const hostId = await online(built.host),
		facts = { relayOrigin: relay.origin, hostId, project: built.project },
		{ actions, save } = fixtureActions({ ...built, facts }, options),
		control = await remoteFixtureControl(options.controlPort ?? 0, actions);
	await mkdir(options.publicDirectory, { recursive: true });
	await save('fixture.json', { ...facts, controlOrigin: control.origin, pid: process.pid });
	const stop = async () => {
		await built.host.stop();
		await control.close();
		await relay.stop();
		for (const path of [state, project.root]) await rm(path, { recursive: true, force: true });
	};
	const entity = { entityId: project.entityId, threadId: project.threadId };
	return { ...facts, controlOrigin: control.origin, entity, stop };
}
