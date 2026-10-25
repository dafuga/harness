import type { Fixture, State } from './devicePairingFixture.types';
export type { Fixture, State } from './devicePairingFixture.types';
import { expect } from 'vitest';
import type { PendingPairing } from '../../src/services/device-pairing-service/DevicePairingService';
import { DevicePairingService } from '../../src/services/device-pairing-service/DevicePairingService';
import { HostPairingService } from '../../src/services/host-pairing-service/HostPairingService';
import { pairingOffer } from '../../../desktop/src/services/remote-host-service/pairingOffer';
import type { OfferEnvironment } from '../../src/utils/pairingOffer';
import { toBase64Url } from '../../src/utils/remoteBytes';
import { remoteIdentity, remotePatterns } from '../../src/utils/remoteIdentity';
import { remoteKeys } from '../../src/utils/remoteKeys';
import { memoryRelay } from '../support/memoryRelay';

export const origin = 'https://relay.example',
	phone = { deviceName: 'Fixture phone', platform: 'test' as const },
	production: OfferEnvironment[] = ['production'],
	grant = { projects: [{ id: 'local-' + 'a'.repeat(64), name: 'Harness' }], agents: true },
	approval = { hostName: 'Fixture Mac', generation: 1, grant };

const reading = (now = Date.now(), environments = production) => ({ now, environments });
export const offerText = (f: Fixture, offer = f.offer) =>
	pairingOffer({ origin, hostId: f.hostId, ...offer });
export const scanText = (f: Fixture, text: string, now = Date.now(), environments = production) =>
	f.device.scanned(text, phone, reading(now, environments));
export const scan = (f: Fixture, offer = f.offer, now = Date.now(), environments = production) =>
	scanText(f, offerText(f, offer), now, environments);

export async function setup() {
	const keys = await remoteKeys(),
		hostId = await remoteIdentity(keys.publicKey),
		host = new HostPairingService({ hostId, keys }),
		relay = memoryRelay({ hostId, hostKey: toBase64Url(keys.publicKey), host }),
		device = new DevicePairingService({ fetch: relay.fetch }),
		offer = host.open();
	relay.open(offer);
	return {
		host,
		hostId,
		relay,
		device,
		offer,
		input: { origin, hostId, pairingId: offer.pairingId, code: offer.code, ...phone }
	};
}

export async function approve(f: Fixture) {
	const result = await f.host.approve(f.offer.pairingId, approval);
	f.relay.approve(f.offer.pairingId, result);
	return result;
}

export async function pendingAt(f: Fixture, state: State) {
	const pending = await f.device.request(f.input);
	if (state === 'requested') return pending;
	if (state === 'denied') {
		expect(f.host.deny(f.offer.pairingId)).toBe(true);
		f.relay.deny(f.offer.pairingId);
		return pending;
	}
	await approve(f);
	if (state === 'exchanged') await f.device.exchange(pending);
	return pending;
}

export async function nextOffer(f: Fixture) {
	const offer = f.host.open();
	f.relay.open(offer);
	return offer;
}

export async function complete(f: Fixture, pending: PendingPairing) {
	const result = await approve(f);
	expect(await f.device.poll(pending)).toBe('approved');
	const credentials = await f.device.exchange(pending);
	expect(credentials).toMatchObject({
		origin,
		hostId: f.hostId,
		deviceId: result.deviceId,
		...approval
	});
	expect(credentials.credential).toMatch(remotePatterns.credential);
	expect(credentials.keys.publicKey).toBe(result.deviceKey);
	return credentials;
}
