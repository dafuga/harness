import { afterEach, expect, test, vi } from 'vitest';
import { DevicePairingService, readPairingOffer } from '../../remote/src/index';
import type { RemotePairingOffer } from '../../remote/src/index';
import { hostFixture } from './remote-host-fixture';

/**
 * Pairing by scanning, on a real host with a relay in memory. The computer shows one QR text;
 * a phone that scanned it waits for the person; a new or withdrawn code stops the earlier one.
 */
const phone = { deviceName: 'Scanning phone', platform: 'test' as const };
const refused = 'The pairing was refused or has expired.';
afterEach(() => vi.useRealTimers());

async function started() {
	const f = await hostFixture();
	await f.host.enable();
	await f.online();
	let asked = 0;
	const counted = ((...call: Parameters<typeof fetch>) => {
		asked++;
		return f.relay.fetch(...call);
	}) as typeof fetch;
	const device = new DevicePairingService({ fetch: counted });
	const scan = (offer: RemotePairingOffer) =>
		device.scanned(offer.scan, phone, { now: Date.now(), environments: ['production'] });
	return { ...f, device, scan, asked: () => asked };
}

test('the computer offers one QR text that reads back to its open offer and holds nothing else', async () => {
	const f = await started(),
		offer = await f.host.devices.createPairing(),
		whole = Math.floor(Date.parse(offer.expiresAt) / 1000) * 1000;
	expect(Object.keys(offer).sort()).toEqual([
		'code',
		'expiresAt',
		'hostId',
		'origin',
		'pairingId',
		'scan'
	]);
	expect(readPairingOffer(offer.scan, { now: Date.now(), environments: ['production'] })).toEqual({
		offer: {
			origin: f.relay.origin,
			hostId: offer.hostId,
			pairingId: offer.pairingId,
			code: offer.code.replace('-', ''),
			expiresAt: new Date(whole).toISOString()
		}
	});
	expect((await f.host.status()).pairing).toEqual(offer);
	const [credential] = f.relay.bearers;
	expect(offer.scan).not.toContain(credential);
}, 30000);

test('a phone that scanned is a request until the person approves it for chosen projects', async () => {
	const f = await started(),
		offer = await f.host.devices.createPairing(),
		pending = await f.scan(offer);
	await expect.poll(async () => (await f.host.status()).requests.length).toBe(1);
	const waiting = await f.host.status();
	expect(waiting.requests).toMatchObject([
		{ pairingId: offer.pairingId, deviceId: pending.deviceId, deviceName: 'Scanning phone' }
	]);
	expect(waiting.devices).toEqual([]);
	expect(await f.device.poll(pending)).toBe('requested');
	const { pairingId } = offer,
		{ deviceId } = pending;
	const approved = await f.host.devices.approvePairing({
		pairingId,
		deviceId,
		projectIds: [f.project.id],
		agents: false
	});
	expect(approved.pairing).toBeNull();
	expect(approved.devices).toMatchObject([
		{ deviceId, name: 'Scanning phone', projectIds: [f.project.id], agents: false }
	]);
	const credentials = await f.device.exchange(pending);
	expect(credentials.grant).toEqual({
		projects: [{ id: f.project.id, name: f.project.name }],
		agents: false
	});
}, 30000);

test('a new code stops the earlier one, and a withdrawn code leaves none', async () => {
	const f = await started(),
		first = await f.host.devices.createPairing(),
		second = await f.host.devices.createPairing();
	expect(second.scan).not.toBe(first.scan);
	await expect(f.scan(first)).rejects.toThrow(refused);
	expect((await f.host.status()).pairing).toEqual(second);
	const closed = await f.host.devices.closePairing();
	expect(closed.pairing).toBeNull();
	await expect(f.scan(second)).rejects.toThrow(refused);
	expect((await f.host.status()).requests).toEqual([]);
}, 30000);

test('denied on the computer, the phone has nothing to exchange and is no device', async () => {
	const f = await started(),
		offer = await f.host.devices.createPairing(),
		pending = await f.scan(offer);
	await expect.poll(async () => (await f.host.status()).requests.length).toBe(1);
	const denied = await f.host.devices.denyPairing({ pairingId: offer.pairingId });
	expect([denied.requests, denied.devices, denied.pairing]).toEqual([[], [], null]);
	expect(await f.device.poll(pending)).toBe('denied');
	await expect(f.device.exchange(pending)).rejects.toThrow();
}, 30000);

test('an offer the clock has passed is neither shown nor asked with', async () => {
	const f = await started(),
		offer = await f.host.devices.createPairing(),
		before = f.asked();
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(Date.parse(offer.expiresAt) + 1000);
	expect((await f.host.status()).pairing).toBeNull();
	await expect(f.scan(offer)).rejects.toThrow('offer-expired');
	expect(f.asked()).toBe(before);
}, 30000);

test('an approved phone can be revoked, and its spent code pairs nobody again', async () => {
	const f = await started(),
		{ offer, credentials } = await f.pair({ projectIds: [f.project.id], agents: true });
	expect((await f.host.status()).devices).toHaveLength(1);
	const revoked = await f.host.devices.revokeDevice({ deviceId: credentials.deviceId });
	expect(revoked.devices).toEqual([]);
	await expect(f.scan(offer)).rejects.toThrow(refused);
	expect((await f.host.status()).requests).toEqual([]);
}, 30000);
