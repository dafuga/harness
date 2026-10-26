import { expect } from 'vitest';
import type { Ctx, State, Setup, Offer } from './hostPairingCases.types';
import { approval, absent, lifetime, requestOf, submit, setup } from './hostPairingCases';
import { openPairing } from '../../src/utils/pairingEnvelope';
import { toBase64Url } from '../../src/utils/remoteBytes';
import { pkceChallenge, remoteIdentity, remotePatterns } from '../../src/utils/remoteIdentity';
import { remoteKeys } from '../../src/utils/remoteKeys';
const noRequest = 'There is no pairing request to approve.';
const otherPhone = 'This is not the phone that was shown.';

async function refusesThenAccepts(f: Setup, offer: Offer) {
	await expect(f.host.receive(null as never)).rejects.toThrow(TypeError);
	const good = (await f.frame(offer.pairingId, f.code(offer))).frame;
	expect(await f.host.receive(good)).toEqual(await requestOf(f, offer));
	expect(f.host.requests()).toEqual([await requestOf(f, offer)]);
	for (const kind of ['challenge', 'sealed', 'pairingId', 'deviceKey', 'deviceName']) {
		const current = f.host.open();
		const frame = await tamperedFrame(f, current, kind);
		expect(await f.host.receive(frame)).toBeNull();
		expect(f.host.offer()).toEqual(current);
	}
	const limited = await setup({ attempts: 2 });
	const limitedOffer = limited.host.open();
	for (let i = 0; i < 2; i++)
		expect(await submit(limited, limitedOffer.pairingId, 'WRNGCDE2')).toBeNull();
	expect(limited.host.offer()).toBeNull();
}
async function tamperedFrame(f: Setup, offer: Offer, kind: string) {
	const code = f.code(offer);
	if (kind === 'deviceKey')
		return (await f.frame(offer.pairingId, code, { deviceKey: 'AAAA' })).frame;
	if (kind === 'deviceName')
		return (await f.frame(offer.pairingId, code, { deviceName: '' })).frame;
	const good = (await f.frame(offer.pairingId, code)).frame;
	if (kind === 'challenge') return { ...good, challenge: await pkceChallenge('another-verifier') };
	if (kind === 'pairingId') return { ...good, pairingId: absent };
	return { ...good, sealed: (good.sealed[0] === 'A' ? 'B' : 'A') + good.sealed.slice(1) };
}

export const checks: Record<
	'open' | 'offer' | 'requests' | 'receive' | 'approve' | 'deny' | 'close',
	(ctx: Ctx, state: State) => unknown
> = {
	open: async ({ f, offer }: Ctx, state: State) => {
		const next = f.host.open();
		expect(next.pairingId).toMatch(remotePatterns.pairingId);
		expect(next.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
		expect(next.expiresAt).toBe(new Date(f.clock.now + lifetime).toISOString());
		if (state === 'initialized') {
			expect(next.expiresAt).toBe('2026-10-12T10:05:00.000Z');
			const custom = await setup({ ttlMs: 1 });
			expect(custom.host.open().expiresAt).toBe('2026-10-12T10:00:00.001Z');
			custom.clock.now++;
			expect(custom.host.offer()).toBeNull();
		}
		expect(f.host.offer()).toEqual(next);
		expect(f.host.requests()).toEqual([]);
		if (!offer) return;
		expect(next.pairingId).not.toBe(offer.pairingId);
		expect(await submit(f, offer.pairingId, f.code(offer))).toBeNull();
		expect(await submit(f, next.pairingId, f.code(next))).not.toBeNull();
	},
	offer: ({ f, offer }: Ctx, state: State) => {
		expect(f.host.offer()).toEqual(state === 'offered' || state === 'requested' ? offer : null);
	},
	requests: async ({ f, offer }: Ctx, state: State) => {
		const pendingRequest = state === 'requested' && offer ? [await requestOf(f, offer)] : [];
		expect(f.host.requests()).toEqual(pendingRequest);
	},
	receive: async ({ f, offer, framed }: Ctx, state: State) => {
		if (state === 'offered' && offer) return refusesThenAccepts(f, offer);
		if (state === 'expired' && framed) {
			expect(await f.host.receive(framed.frame)).toBeNull();
			expect(f.host.offer()).toBeNull();
			return;
		}
		const id = offer?.pairingId ?? absent;
		expect(await submit(f, id, offer ? f.code(offer) : 'WRNGCDE2')).toBeNull();
	},
	approve: async ({ f, offer, framed }: Ctx, state: State) => {
		if (state !== 'requested' || !offer || !framed) {
			const input = state === 'denied' ? { ...approval, generation: 1 } : approval;
			await expect(f.host.approve(offer?.pairingId ?? absent, input)).rejects.toThrow(noRequest);
			return;
		}
		await expect(f.host.approve(offer.pairingId, null as never)).rejects.toThrow(TypeError);
		const stranger = await remoteIdentity((await remoteKeys()).publicKey);
		const refused = { ...approval, deviceId: stranger };
		await expect(f.host.approve(offer.pairingId, refused)).rejects.toThrow(otherPhone);
		const approved = await f.host.approve(offer.pairingId, approval);
		const deviceId = await remoteIdentity(f.device.publicKey);
		expect(approved).toMatchObject({
			deviceId,
			deviceKey: toBase64Url(f.device.publicKey),
			deviceName: 'Fixture phone',
			platform: 'test'
		});
		expect(f.host.requests()).toEqual([]);
		await expect(f.host.approve(offer.pairingId, approval)).rejects.toThrow(noRequest);
		const opened = await openPairing(framed.envelope.approval, 'approval', approved.sealed);
		expect(opened).toEqual({ deviceId, ...approval });
	},
	deny: ({ f, offer }: Ctx, state: State) => {
		expect(f.host.deny(offer?.pairingId ?? absent)).toBe(state === 'requested');
		if (state === 'requested') {
			expect(f.host.deny(offer!.pairingId)).toBe(false);
			expect(f.host.requests()).toEqual([]);
		}
	},
	close: ({ f }: Ctx) => {
		expect(f.host.close()).toBeUndefined();
		expect(f.host.offer()).toBeNull();
		expect(f.host.requests()).toEqual([]);
	}
};
