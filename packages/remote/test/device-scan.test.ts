import { expect, test } from 'vitest';
import { DevicePairingService } from '../src/services/DevicePairingService';
import { HostPairingService } from '../src/services/HostPairingService';
import { pairingOffer } from '../src/utils/pairingOffer';
import type { OfferEnvironment } from '../src/utils/pairingOffer';
import { toBase64Url } from '../src/utils/remoteBytes';
import { remoteIdentity } from '../src/utils/remoteIdentity';
import { remoteKeys } from '../src/utils/remoteKeys';
import { memoryRelay } from './support/memoryRelay';

/**
 * A phone that scanned the QR code of a computer, as the native app does it: the scanned text
 * is all it has. Asking is not pairing: nothing is exchanged before the person approves.
 */
const origin = 'https://relay.example';
const grant = { projects: [{ id: 'local-' + 'a'.repeat(64), name: 'Harness' }], agents: false },
	approval = { hostName: 'Fixture Mac', generation: 1, grant };
const phone = { deviceName: 'Fixture phone', platform: 'test' as const };
const production: OfferEnvironment[] = ['production'];

async function setup() {
	const keys = await remoteKeys(),
		hostId = await remoteIdentity(keys.publicKey),
		host = new HostPairingService({ hostId, keys });
	const relay = memoryRelay({ hostId, hostKey: toBase64Url(keys.publicKey), host }),
		device = new DevicePairingService({ fetch: relay.fetch });
	/** What the computer shows: the text of its QR code for the offer it just opened. */
	const shown = () => {
		const offer = host.open();
		relay.open(offer);
		return { offer, text: pairingOffer({ origin, hostId, ...offer }) };
	};
	const scan = (text: string, now = Date.now(), environments = production) =>
		device.scanned(text, phone, { now, environments });
	return { host, hostId, relay, device, shown, scan };
}

test('a scanned offer asks the computer and is paired only once the person approves', async () => {
	const f = await setup(),
		{ offer, text } = f.shown(),
		pending = await f.scan(text);
	expect(f.host.requests()).toMatchObject([
		{ pairingId: offer.pairingId, deviceId: pending.deviceId, deviceName: 'Fixture phone' }
	]);
	expect(await f.device.poll(pending)).toBe('requested');
	const approved = await f.host.approve(offer.pairingId, {
		...approval,
		deviceId: pending.deviceId
	});
	f.relay.approve(offer.pairingId, approved);
	expect(await f.device.poll(pending)).toBe('approved');
	const credentials = await f.device.exchange(pending);
	expect(credentials).toMatchObject({
		origin,
		hostId: f.hostId,
		deviceId: pending.deviceId,
		grant
	});
});

test('scanning is not approval: an exchange before the person approved gets nothing', async () => {
	const f = await setup(),
		pending = await f.scan(f.shown().text);
	expect(await f.device.poll(pending)).toBe('requested');
	await expect(f.device.exchange(pending)).rejects.toThrow();
	expect(f.host.requests()).toHaveLength(1);
});

test('a denied request leaves the phone with nothing to exchange', async () => {
	const f = await setup(),
		{ offer, text } = f.shown(),
		pending = await f.scan(text);
	expect(f.host.deny(offer.pairingId)).toBe(true);
	f.relay.deny(offer.pairingId);
	expect(await f.device.poll(pending)).toBe('denied');
	await expect(f.device.exchange(pending)).rejects.toThrow();
});

test('an offer is used once: a second scan never takes the place of the first, and a spent offer answers nobody', async () => {
	const f = await setup(),
		{ offer, text } = f.shown(),
		first = await f.scan(text);
	await f.scan(text);
	expect(f.relay.received).toHaveLength(2);
	expect(f.relay.received[1]).toBeNull();
	expect(f.host.requests()).toMatchObject([{ deviceId: first.deviceId }]);
	const approved = await f.host.approve(offer.pairingId, approval);
	expect(approved.deviceId).toBe(first.deviceId);
	expect(f.host.offer()).toBeNull();
	await f.scan(text);
	expect(f.relay.received[2]).toBeNull();
	expect(f.host.requests()).toEqual([]);
});

test('a new code stops the one before it, on the computer and at the relay', async () => {
	const f = await setup(),
		earlier = f.shown(),
		current = f.shown();
	await f.scan(earlier.text);
	expect(f.relay.received).toEqual([null]);
	expect(f.host.requests()).toEqual([]);
	f.relay.close(earlier.offer.pairingId);
	await expect(f.scan(earlier.text)).rejects.toThrow('The pairing was refused or has expired.');
	const pending = await f.scan(current.text);
	expect(f.host.requests()).toMatchObject([{ deviceId: pending.deviceId }]);
});

test('a code that is not a current offer for this build sends nothing at all', async () => {
	const f = await setup(),
		{ text } = f.shown(),
		later = Date.now() + 301_000;
	const refused: [string, Promise<unknown>][] = [
		['offer-expired', f.scan(text, later)],
		['offer-environment', f.scan(text, Date.now(), ['local'])],
		['offer-unsupported', f.scan(text.replace('harness-pair:v1;', 'harness-pair:v2;'))],
		['offer-invalid', f.scan(text + ';credential=abc')],
		['offer-invalid', f.scan(`harnessremote://pair?origin=${origin}&host=${f.hostId}`)],
		['offer-invalid', f.scan('')]
	];
	for (const [code, attempt] of refused) await expect(attempt).rejects.toThrow(code);
	expect(f.relay.calls).toEqual([]);
	expect(f.host.requests()).toEqual([]);
});
