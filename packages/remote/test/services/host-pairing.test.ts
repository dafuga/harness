import { expect, test } from 'vitest';
import type { PairingApproval } from '../../src/models/networking-security/RemoteSecure.types';
import { HostPairingService } from '../../src/services/host-pairing-service/HostPairingService';
import {
	openPairing,
	pairingEnvelope,
	sealPairing
} from '../../src/utils/networking-security/pairingEnvelope';
import { toBase64Url } from '../../src/utils/remoteBytes';
import { pkceChallenge, remoteIdentity } from '../../src/utils/remoteIdentity';
import { remoteKeys, sharedSecret } from '../../src/utils/remoteKeys';

const grant = { projects: [{ id: 'local-' + 'a'.repeat(64), name: 'Harness' }], agents: true };
const pairingId = 'b'.repeat(32);
async function setup() {
	const clock = { now: Date.parse('2026-10-12T10:00:00Z') },
		keys = await remoteKeys(),
		device = await remoteKeys(),
		hostId = await remoteIdentity(keys.publicKey);
	const host = new HostPairingService({ hostId, keys, now: () => clock.now });
	/** What the relay hands the host for a signed-in account: an account frame, an empty code. */
	async function frame(id: string, overrides: Record<string, unknown> = {}, account = true) {
		const ephemeral = await remoteKeys(),
			challenge = await pkceChallenge('fixture-verifier');
		const envelope = await pairingEnvelope({
			hostId,
			pairingId: id,
			ephemeralKey: ephemeral.publicKey,
			hostKey: keys.publicKey,
			secret: await sharedSecret(ephemeral.privateKey, keys.publicKey)
		});
		const secret = {
			code: '',
			deviceKey: toBase64Url(device.publicKey),
			deviceName: 'Fixture phone',
			platform: 'test',
			challenge,
			...overrides
		};
		const sealed = await sealPairing(envelope.request, 'request', secret);
		const expiresAt = new Date(clock.now + 300000).toISOString();
		return {
			envelope,
			expiresAt,
			frame: {
				pairingId: id,
				ephemeralKey: toBase64Url(ephemeral.publicKey),
				sealed,
				challenge,
				...(account && { account: true as const, expiresAt })
			}
		};
	}
	return { host, hostId, device, frame, clock };
}

test('an account request yields one request for the exact device key', async () => {
	const f = await setup(),
		{ frame, expiresAt } = await f.frame(pairingId);
	const request = await f.host.receive(frame);
	expect(request).toEqual({
		pairingId,
		deviceId: await remoteIdentity(f.device.publicKey),
		deviceName: 'Fixture phone',
		platform: 'test',
		requestedAt: '2026-10-12T10:00:00.000Z',
		expiresAt
	});
	expect(f.host.requests()).toEqual([request]);
	expect(await f.host.receive((await f.frame(pairingId)).frame)).toBeNull();
});
test('a request that is not an account frame, or carries a code, is refused', async () => {
	const f = await setup();
	expect(await f.host.receive((await f.frame(pairingId, {}, false)).frame)).toBeNull();
	expect(await f.host.receive((await f.frame(pairingId, { code: 'ABCDEFGH' })).frame)).toBeNull();
	expect(f.host.requests()).toEqual([]);
});
test('a relay cannot swap the challenge, the envelope, the pairing or the key', async () => {
	const f = await setup();
	const good = (await f.frame(pairingId)).frame;
	const refused = [
		{ ...good, challenge: await pkceChallenge('another-verifier') },
		{ ...good, sealed: (good.sealed[0] === 'A' ? 'B' : 'A') + good.sealed.slice(1) },
		{ ...good, pairingId: 'c'.repeat(32) },
		(await f.frame(pairingId, { deviceKey: 'AAAA' })).frame,
		(await f.frame(pairingId, { deviceName: '' })).frame
	];
	for (const frame of refused) expect(await f.host.receive(frame)).toBeNull();
});
test('an expired request accepts nothing', async () => {
	const f = await setup(),
		{ frame } = await f.frame(pairingId);
	f.clock.now += 300001;
	expect(await f.host.receive(frame)).toBeNull();
	expect(f.host.requests()).toEqual([]);
});
test('approval seals the grant to the requesting device and can be used once', async () => {
	const f = await setup(),
		{ frame, envelope } = await f.frame(pairingId);
	await f.host.receive(frame);
	const approval = { hostName: 'Fixture Mac', generation: 4, grant },
		approved = await f.host.approve(pairingId, approval),
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
	await expect(f.host.approve(pairingId, approval)).rejects.toThrow();
});
test('denying removes the request and nothing can be approved afterwards', async () => {
	const f = await setup();
	await f.host.receive((await f.frame(pairingId)).frame);
	expect(f.host.deny(pairingId)).toBe(true);
	expect(f.host.deny(pairingId)).toBe(false);
	expect(f.host.requests()).toEqual([]);
	await expect(
		f.host.approve(pairingId, { hostName: 'Fixture Mac', generation: 1, grant })
	).rejects.toThrow();
});
