// @harness-uid u_at4omr5js3
import type {
	Offer,
	HostPairingOptions,
	HostPairingFrame,
	HostPairingApproved,
	Requested
} from './HostPairingService.types';
import { PairingPhoneMismatchError } from './PairingPhoneMismatchError';
import { PairingRequestNotFoundError } from './PairingRequestNotFoundError';
import { remoteLimits } from '../../../../../../remote/src/models/Remote.types';
import type { RemoteGrant } from '../../../../../../remote/src/models/Remote.types';
import type { RemotePairingRequest } from '../../../../../../remote/src/models/networking-security/RemoteControl.types';
import type { PairingSecret } from '../../../../../../remote/src/models/networking-security/RemoteSecure.types';
import {
	openPairing,
	pairingEnvelope,
	sealPairing
} from '../../../../../../remote/src/utils/networking-security/pairingEnvelope';
import { fromBase64Url, safeEqual } from '../../../../../../remote/src/utils/remoteBytes';
import { remoteIdentity } from '../../../../../../remote/src/utils/remoteIdentity';
import { remotePatterns } from '../../../../../../remote/src/utils/remoteIdentity';
import { sharedSecret } from '../../../../../../remote/src/utils/remoteKeys';

const platforms = ['ios', 'web', 'test'];

function secretOf(value: unknown): PairingSecret | null {
	const item = (value ?? {}) as Partial<PairingSecret>,
		name = typeof item.deviceName === 'string' ? item.deviceName : '';
	const valid =
		Object.keys(item).length === 5 &&
		typeof item.code === 'string' &&
		remotePatterns.key.test(String(item.deviceKey)) &&
		remotePatterns.challenge.test(String(item.challenge)) &&
		platforms.includes(String(item.platform)) &&
		name.trim().length > 0 &&
		name.length <= 80;
	return valid ? (item as PairingSecret) : null;
}

async function openRequest(
	options: HostPairingOptions,
	offer: Offer,
	frame: HostPairingFrame,
	now: number
): Promise<Requested | null> {
	const { hostId, keys } = options,
		ephemeralKey = fromBase64Url(frame.ephemeralKey);
	const secret = await sharedSecret(keys.privateKey, ephemeralKey);
	const context = { hostId, pairingId: offer.pairingId, ephemeralKey, hostKey: keys.publicKey };
	const envelope = await pairingEnvelope({ ...context, secret });
	const sealed = secretOf(await openPairing(envelope.request, 'request', frame.sealed));
	const proven =
		sealed !== null && sealed.code === '' && safeEqual(sealed.challenge, frame.challenge);
	if (!proven) return null;
	await sharedSecret(keys.privateKey, fromBase64Url(sealed.deviceKey));
	return {
		pairingId: offer.pairingId,
		deviceId: await remoteIdentity(sealed.deviceKey),
		deviceName: sealed.deviceName,
		platform: sealed.platform,
		requestedAt: new Date(now).toISOString(),
		expiresAt: offer.expiresAt,
		challenge: sealed.challenge,
		deviceKey: sealed.deviceKey,
		approvalKey: envelope.approval
	};
}

/** The computer receives requests only from the verified account frames of its relay. */
export class HostPairingService {
	private account: Offer | null = null;
	constructor(private readonly options: HostPairingOptions) {}
	requests(): RemotePairingRequest[] {
		const request = this.live()?.request;
		if (!request) return [];
		const { pairingId, deviceId, deviceName, platform, requestedAt, expiresAt } = request;
		return [{ pairingId, deviceId, deviceName, platform, requestedAt, expiresAt }];
	}
	/** A relay-authenticated account request uses an empty code, sealed to this Mac's key. */
	async receive(frame: HostPairingFrame): Promise<RemotePairingRequest | null> {
		const offer = frame.account === true ? this.accountOffer(frame) : null;
		if (!offer || offer.pairingId !== frame.pairingId || offer.request) return null;
		const request = await this.opened(offer, frame).catch(() => null);
		if (this.live() !== offer || offer.request) return null;
		if (!request) return this.miss(offer);
		offer.request = request;
		return this.requests().find((item) => item.pairingId === frame.pairingId) ?? null;
	}
	/** Seals the grant to the key that asked. The request is spent, whatever happens next. */
	async approve(
		pairingId: string,
		approval: { hostName: string; generation: number; grant: RemoteGrant; deviceId?: string }
	): Promise<HostPairingApproved> {
		const request = this.requested(pairingId)?.request;
		if (!request) throw new PairingRequestNotFoundError('There is no pairing request to approve.');
		const { deviceId: shown, ...granted } = approval;
		if (shown !== undefined && shown !== request.deviceId)
			throw new PairingPhoneMismatchError('This is not the phone that was shown.');
		this.account = null;
		const { deviceId, deviceKey, deviceName, platform, challenge } = request;
		const sealed = await sealPairing(request.approvalKey, 'approval', { deviceId, ...granted });
		return { deviceId, deviceKey, deviceName, platform, sealed, challenge };
	}
	deny(pairingId: string): boolean {
		if (!this.requested(pairingId)?.request) return false;
		this.account = null;
		return true;
	}
	close(): void {
		this.account = null;
	}
	private requested(pairingId: string): Offer | undefined {
		const offer = this.live();
		return offer?.pairingId === pairingId ? offer : undefined;
	}
	private accountOffer({ pairingId, expiresAt }: HostPairingFrame): Offer | null {
		const now = this.now(),
			end = Date.parse(expiresAt ?? '');
		if (!expiresAt || !(end > now && end <= now + remoteLimits.pairingTtlMs + 60_000)) return null;
		return this.live() ?? (this.account = { pairingId, expiresAt, request: null });
	}
	private opened(offer: Offer, frame: HostPairingFrame): Promise<Requested | null> {
		return openRequest(this.options, offer, frame, this.now());
	}
	/** An account request that does not prove itself is dropped; a new one may follow. */
	private miss(offer: Offer): null {
		if (this.account === offer) this.account = null;
		return null;
	}
	private live(): Offer | null {
		const offer = this.account;
		if (!offer || Date.parse(offer.expiresAt) > this.now()) return offer;
		this.account = null;
		return null;
	}
	private now(): number {
		return this.options.now?.() ?? Date.now();
	}
}

export type {
	HostPairingOptions,
	HostPairingFrame,
	HostPairingApproved
} from './HostPairingService.types';
