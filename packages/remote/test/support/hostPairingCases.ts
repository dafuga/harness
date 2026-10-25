import { expect } from 'vitest';
import type { Setup, Offer, PairingOverrides } from './hostPairingCases.types';
import { HostPairingService } from '../../src/services/host-pairing-service/HostPairingService';
import { pairingEnvelope, sealPairing } from '../../src/utils/pairingEnvelope';
import { toBase64Url } from '../../src/utils/remoteBytes';
import { pkceChallenge, remoteIdentity } from '../../src/utils/remoteIdentity';
import { remoteKeys, sharedSecret } from '../../src/utils/remoteKeys';

export const grant = {
	projects: [{ id: 'local-' + 'a'.repeat(64), name: 'Harness' }],
	agents: true
};
export const approval = { hostName: 'Fixture Mac', generation: 4, grant };
export const absent = 'c'.repeat(32);
export const lifetime = 300000;
export async function setup(overrides: { ttlMs?: number; attempts?: number } = {}) {
	const clock = { now: Date.parse('2026-10-12T10:00:00Z') },
		keys = await remoteKeys(),
		device = await remoteKeys(),
		hostId = await remoteIdentity(keys.publicKey);
	const host = new HostPairingService({ hostId, keys, now: () => clock.now, ...overrides });
	async function frame(pairingId: string, code: string, overrides: PairingOverrides = {}) {
		const ephemeral = await remoteKeys(),
			challenge = await pkceChallenge('fixture-verifier');
		const envelope = await pairingEnvelope({
			hostId,
			pairingId,
			ephemeralKey: ephemeral.publicKey,
			hostKey: keys.publicKey,
			secret: await sharedSecret(ephemeral.privateKey, keys.publicKey)
		});
		const secret = {
			code,
			deviceKey: toBase64Url(device.publicKey),
			deviceName: 'Fixture phone',
			platform: 'test',
			challenge,
			...overrides
		};
		const sealed = await sealPairing(envelope.request, 'request', secret);
		return {
			envelope,
			frame: { pairingId, ephemeralKey: toBase64Url(ephemeral.publicKey), sealed, challenge }
		};
	}
	const code = (offer: { code: string }) => offer.code.replace('-', '');
	return { host, hostId, device, frame, clock, code };
}
export const submit = async (f: Setup, id: string, code: string, o: PairingOverrides = {}) =>
	f.host.receive((await f.frame(id, code, o)).frame);
async function pending(f: Setup) {
	const offer = f.host.open(),
		framed = await f.frame(offer.pairingId, f.code(offer));
	expect(await f.host.receive(framed.frame)).toMatchObject({ pairingId: offer.pairingId });
	return { f, offer, framed };
}
/** Lifecycle states, each reached by public calls in its own case. */
export const reaches = {
	initialized: async (f: Setup) => ({ f, offer: null }),
	offered: async (f: Setup) => ({ f, offer: f.host.open() }),
	requested: pending,
	exhausted: async (f: Setup) => {
		const offer = f.host.open();
		for (let i = 0; i < 5; i++) expect(await submit(f, offer.pairingId, 'WRNGCDE2')).toBeNull();
		return { f, offer };
	},
	expired: async (f: Setup) => {
		const offer = f.host.open();
		const framed = await f.frame(offer.pairingId, f.code(offer));
		f.clock.now += lifetime + 1;
		return { f, offer, framed };
	},
	approved: async (f: Setup) => {
		const { offer } = await pending(f);
		await f.host.approve(offer.pairingId, approval);
		return { f, offer };
	},
	closed: async (f: Setup) => {
		await pending(f);
		f.host.close();
		return { f, offer: null };
	},
	denied: async (f: Setup) => {
		const { offer } = await pending(f);
		expect(f.host.deny(offer.pairingId)).toBe(true);
		return { f, offer };
	}
};
export async function requestOf(f: Setup, offer: Offer) {
	return {
		pairingId: offer.pairingId,
		deviceId: await remoteIdentity(f.device.publicKey),
		deviceName: 'Fixture phone',
		platform: 'test',
		requestedAt: '2026-10-12T10:00:00.000Z',
		expiresAt: offer.expiresAt
	};
}
