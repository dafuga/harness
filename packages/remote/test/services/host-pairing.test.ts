import { expect, test } from 'vitest';
import type { PairingApproval } from '../../src/models/RemoteSecure.types';
import { HostPairingService } from '../../src/services/host-pairing-service/HostPairingService';
import { openPairing, pairingEnvelope, sealPairing } from '../../src/utils/pairingEnvelope';
import { toBase64Url } from '../../src/utils/remoteBytes';
import { pkceChallenge, remoteIdentity, remotePatterns } from '../../src/utils/remoteIdentity';
import { remoteKeys, sharedSecret } from '../../src/utils/remoteKeys';

const grant = { projects: [{ id: 'local-' + 'a'.repeat(64), name: 'Harness' }], agents: true };
async function setup() {
	const clock = { now: Date.parse('2026-10-12T10:00:00Z') },
		keys = await remoteKeys(),
		device = await remoteKeys(),
		hostId = await remoteIdentity(keys.publicKey);
	const host = new HostPairingService({ hostId, keys, now: () => clock.now });
	async function frame(pairingId: string, code: string, overrides: Record<string, unknown> = {}) {
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

test('an offer has a public id, a typed code and a short life', async () => {
	const f = await setup(),
		offer = f.host.open();
	expect(offer.pairingId).toMatch(remotePatterns.pairingId);
	expect(offer.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
	expect(offer.expiresAt).toBe('2026-10-12T10:05:00.000Z');
	expect(f.host.offer()).toEqual(offer);
});
test('the right code yields one request for the exact device key', async () => {
	const f = await setup(),
		offer = f.host.open(),
		{ frame } = await f.frame(offer.pairingId, f.code(offer));
	const request = await f.host.receive(frame);
	expect(request).toEqual({
		pairingId: offer.pairingId,
		deviceId: await remoteIdentity(f.device.publicKey),
		deviceName: 'Fixture phone',
		platform: 'test',
		requestedAt: '2026-10-12T10:00:00.000Z',
		expiresAt: offer.expiresAt
	});
	expect(f.host.requests()).toEqual([request]);
	expect(await f.host.receive((await f.frame(offer.pairingId, f.code(offer))).frame)).toBeNull();
});
test('a wrong code is refused and five wrong codes close the offer', async () => {
	const f = await setup(),
		offer = f.host.open();
	for (let attempt = 0; attempt < 5; attempt++)
		expect(await f.host.receive((await f.frame(offer.pairingId, 'WRNGCDE2')).frame)).toBeNull();
	expect(await f.host.receive((await f.frame(offer.pairingId, f.code(offer))).frame)).toBeNull();
	expect(f.host.offer()).toBeNull();
	expect(f.host.requests()).toEqual([]);
});
test('a relay cannot swap the challenge, the envelope, the pairing or the key', async () => {
	const f = await setup(),
		offer = f.host.open(),
		code = f.code(offer),
		good = (await f.frame(offer.pairingId, code)).frame;
	const refused = [
		{ ...good, challenge: await pkceChallenge('another-verifier') },
		{ ...good, sealed: (good.sealed[0] === 'A' ? 'B' : 'A') + good.sealed.slice(1) },
		{ ...good, pairingId: 'c'.repeat(32) },
		(await f.frame(offer.pairingId, code, { deviceKey: 'AAAA' })).frame,
		(await f.frame(offer.pairingId, code, { deviceName: '' })).frame
	];
	for (const frame of refused) expect(await f.host.receive(frame)).toBeNull();
});
test('an expired offer accepts nothing', async () => {
	const f = await setup(),
		offer = f.host.open(),
		{ frame } = await f.frame(offer.pairingId, f.code(offer));
	f.clock.now += 300001;
	expect(await f.host.receive(frame)).toBeNull();
	expect(f.host.offer()).toBeNull();
});
test('a new offer replaces the old one', async () => {
	const f = await setup(),
		old = f.host.open(),
		next = f.host.open();
	expect(next.pairingId).not.toBe(old.pairingId);
	expect(await f.host.receive((await f.frame(old.pairingId, f.code(old))).frame)).toBeNull();
	expect(await f.host.receive((await f.frame(next.pairingId, f.code(next))).frame)).not.toBeNull();
});
test('approval seals the grant to the requesting device and can be used once', async () => {
	const f = await setup(),
		offer = f.host.open(),
		{ frame, envelope } = await f.frame(offer.pairingId, f.code(offer));
	await f.host.receive(frame);
	const approval = { hostName: 'Fixture Mac', generation: 4, grant },
		approved = await f.host.approve(offer.pairingId, approval),
		deviceId = await remoteIdentity(f.device.publicKey);
	expect(approved).toMatchObject({
		deviceId,
		deviceKey: toBase64Url(f.device.publicKey),
		deviceName: 'Fixture phone',
		platform: 'test'
	});
	const opened = (await openPairing(
		envelope.approval,
		'approval',
		approved.sealed
	)) as PairingApproval;
	expect(opened).toEqual({ deviceId, ...approval });
	expect(f.host.requests()).toEqual([]);
	await expect(f.host.approve(offer.pairingId, approval)).rejects.toThrow();
});
test('denying removes the request and nothing can be approved afterwards', async () => {
	const f = await setup(),
		offer = f.host.open();
	await f.host.receive((await f.frame(offer.pairingId, f.code(offer))).frame);
	expect(f.host.deny(offer.pairingId)).toBe(true);
	expect(f.host.deny(offer.pairingId)).toBe(false);
	expect(f.host.requests()).toEqual([]);
	await expect(
		f.host.approve(offer.pairingId, { hostName: 'Fixture Mac', generation: 1, grant })
	).rejects.toThrow();
});
