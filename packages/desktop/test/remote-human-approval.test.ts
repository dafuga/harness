import { expect } from '../../../test/verificationExpect';
import { afterEach, test, vi } from 'vitest';
import {
	HostPairingService,
	pairingEnvelope,
	pkceChallenge,
	remoteIdentity,
	remoteKeys,
	sealPairing,
	sharedSecret,
	toBase64Url
} from '../../remote/src/index';
import type { HostPairingOffer, RemoteKeyPair } from '../../remote/src/index';
import { RemotePairingControlService } from '../src/services/RemotePairingControlService';
import type { RemoteHostAccess } from '../src/services/RemotePairingControlService';
import type { ProjectRegistryService } from '../src/services/ProjectRegistryService';
import { deferred } from './remote-fixture';

afterEach(() => vi.restoreAllMocks());
type Opening = { opened: (...args: unknown[]) => Promise<{ deviceName: string } | null> };

async function frame(keys: RemoteKeyPair, offer: HostPairingOffer, name: string) {
	const device = await remoteKeys(),
		ephemeral = await remoteKeys();
	const hostId = await remoteIdentity(keys.publicKey),
		challenge = await pkceChallenge(name);
	const envelope = await pairingEnvelope({
		hostId,
		pairingId: offer.pairingId,
		ephemeralKey: ephemeral.publicKey,
		hostKey: keys.publicKey,
		secret: await sharedSecret(ephemeral.privateKey, keys.publicKey)
	});
	const secret = {
		code: offer.code.replace('-', ''),
		deviceKey: toBase64Url(device.publicKey),
		deviceName: name,
		platform: 'test',
		challenge
	};
	return {
		pairingId: offer.pairingId,
		ephemeralKey: toBase64Url(ephemeral.publicKey),
		challenge,
		sealed: await sealPairing(envelope.request, 'request', secret)
	};
}

/** Both requests pass the initial guard; real decryption of B returns after A is displayed. */
async function concurrent() {
	const keys = await remoteKeys(),
		hostId = await remoteIdentity(keys.publicKey);
	const pairing = new HostPairingService({ keys, hostId }),
		offer = pairing.open();
	const a = await frame(keys, offer, 'Phone A'),
		b = await frame(keys, offer, 'Phone B');
	const gate = deferred(),
		opened = (pairing as unknown as Opening).opened.bind(pairing);
	vi.spyOn(pairing as unknown as Opening, 'opened').mockImplementation(async (...args) => {
		const value = await opened(...args);
		if (value?.deviceName === 'Phone B') await gate.promise;
		return value;
	});
	const first = pairing.receive(a),
		second = pairing.receive(b);
	const displayed = await first;
	if (!displayed) throw new Error('Real Phone A request must validate');
	return { pairing, offer, displayed, second, gate };
}

test('a concurrent valid request cannot replace the phone already displayed', async () => {
	const f = await concurrent();
	f.gate.resolve();
	await f.second;
	expect(f.pairing.requests()).toMatchObject([{ deviceId: f.displayed.deviceId }]);
});

test('approval after project discovery stays bound to the displayed phone', async () => {
	const f = await concurrent(),
		entered = deferred(),
		registryGate = deferred();
	const state = { devices: [] as { deviceId: string }[], revoked: [] as string[] };
	const runtime = {
		pairing: f.pairing,
		sessions: { revoke: vi.fn() },
		link: { command: async () => undefined }
	};
	const host = {
		current: () => ({ state, runtime }),
		name: () => 'Fixture Mac',
		saved: async () => ({}),
		published: async () => ({ devices: state.devices })
	};
	const projectId = 'local-' + 'a'.repeat(64);
	const registry = {
		list: async () => {
			entered.resolve();
			await registryGate.promise;
			return [{ id: projectId, name: 'One' }];
		}
	};
	const control = new RemotePairingControlService(
		host as unknown as RemoteHostAccess,
		registry as unknown as ProjectRegistryService
	);
	const pending = control
		.approvePairing({
			pairingId: f.offer.pairingId,
			projectIds: [projectId],
			agents: true
		})
		.then(
			() => true,
			() => false
		);
	await Promise.race([entered.promise, pending]);
	f.gate.resolve();
	await f.second;
	registryGate.resolve();
	await pending;
	expect(state.devices.every((device) => device.deviceId === f.displayed.deviceId)).toBe(true);
});
