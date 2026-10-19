import { remoteLimits } from '../../models/Remote.types.ts';
import type { RemoteGrant } from '../../models/Remote.types.ts';
import type { RemotePairingRequest } from '../../models/RemoteControl.types.ts';
import type { RelayPairingRequest } from '../../models/RemoteRelay.types.ts';
import type { PairingSecret, RemoteKeyPair } from '../../models/RemoteSecure.types.ts';
import { openPairing, pairingEnvelope, sealPairing } from '../../utils/pairingEnvelope';
import { fromBase64Url, safeEqual } from '../../utils/remoteBytes';
import { normalizeCode, randomId, remoteIdentity } from '../../utils/remoteIdentity';
import { pairingCode } from './remoteIdentity';
import { remotePatterns } from '../../utils/remoteIdentity';
import { sharedSecret } from '../../utils/remoteKeys';

export interface HostPairingOptions {
	hostId: string;
	keys: RemoteKeyPair;
	now?: () => number;
	ttlMs?: number;
	attempts?: number;
}

export interface HostPairingOffer {
	pairingId: string;
	code: string;
	expiresAt: string;
}

export interface HostPairingFrame extends RelayPairingRequest {
	pairingId: string;
}

export interface HostPairingApproved {
	deviceId: string;
	deviceKey: string;
	deviceName: string;
	platform: string;
	sealed: string;
	/** The challenge of the request that was approved: the relay binds the approval to it. */
	challenge: string;
}

interface Requested extends RemotePairingRequest {
	challenge: string;
	deviceKey: string;
	approvalKey: CryptoKey;
}

interface Offer extends HostPairingOffer {
	misses: number;
	request: Requested | null;
}

const platforms = ['ios', 'test'];

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

/** The computer's side of pairing: one open offer, a typed code, approval of one exact key. */
export class HostPairingService {
	private current: Offer | null = null;
	constructor(private readonly options: HostPairingOptions) {}
	/** A new offer. An earlier one stops working. */
	open(): HostPairingOffer {
		const ttl = this.options.ttlMs ?? remoteLimits.pairingTtlMs,
			expiresAt = new Date(this.now() + ttl).toISOString();
		this.current = {
			pairingId: randomId(16),
			code: pairingCode(),
			expiresAt,
			misses: 0,
			request: null
		};
		return { pairingId: this.current.pairingId, code: this.current.code, expiresAt };
	}
	offer(): HostPairingOffer | null {
		const live = this.live();
		return live ? { pairingId: live.pairingId, code: live.code, expiresAt: live.expiresAt } : null;
	}
	requests(): RemotePairingRequest[] {
		const request = this.live()?.request;
		if (!request) return [];
		const { pairingId, deviceId, deviceName, platform, requestedAt, expiresAt } = request;
		return [{ pairingId, deviceId, deviceName, platform, requestedAt, expiresAt }];
	}
	/** Null unless the sealed request opens with this host's key and holds the offer's code. */
	async receive(frame: HostPairingFrame): Promise<RemotePairingRequest | null> {
		const offer = this.live();
		if (!offer || offer.pairingId !== frame.pairingId || offer.request) return null;
		const request = await this.opened(offer, frame).catch(() => null);
		/* Opening takes time. The first valid request stays: a later one never takes its place. */
		if (this.current !== offer || offer.request) return null;
		if (!request) return this.miss(offer);
		offer.request = request;
		return this.requests()[0];
	}
	/** Seals the grant to the key that asked. The offer is spent, whatever happens next. */
	async approve(
		pairingId: string,
		approval: { hostName: string; generation: number; grant: RemoteGrant; deviceId?: string }
	): Promise<HostPairingApproved> {
		const request = this.requested(pairingId);
		if (!request) throw new Error('There is no pairing request to approve.');
		const { deviceId: shown, ...granted } = approval;
		if (shown !== undefined && shown !== request.deviceId)
			throw new Error('This is not the phone that was shown.');
		this.current = null;
		const { deviceId, deviceKey, deviceName, platform, challenge } = request;
		const sealed = await sealPairing(request.approvalKey, 'approval', { deviceId, ...granted });
		return { deviceId, deviceKey, deviceName, platform, sealed, challenge };
	}
	deny(pairingId: string): boolean {
		if (!this.requested(pairingId)) return false;
		this.current = null;
		return true;
	}
	close(): void {
		this.current = null;
	}
	private requested(pairingId: string): Requested | null {
		const live = this.live();
		return live?.pairingId === pairingId ? live.request : null;
	}
	private async opened(offer: Offer, frame: HostPairingFrame): Promise<Requested | null> {
		const { hostId, keys } = this.options,
			ephemeralKey = fromBase64Url(frame.ephemeralKey);
		const secret = await sharedSecret(keys.privateKey, ephemeralKey);
		const context = { hostId, pairingId: offer.pairingId, ephemeralKey, hostKey: keys.publicKey };
		const envelope = await pairingEnvelope({ ...context, secret });
		const sealed = secretOf(await openPairing(envelope.request, 'request', frame.sealed));
		const proven =
			sealed !== null &&
			safeEqual(normalizeCode(sealed.code), normalizeCode(offer.code)) &&
			safeEqual(sealed.challenge, frame.challenge);
		if (!proven) return null;
		await sharedSecret(keys.privateKey, fromBase64Url(sealed.deviceKey));
		return {
			pairingId: offer.pairingId,
			deviceId: await remoteIdentity(sealed.deviceKey),
			deviceName: sealed.deviceName,
			platform: sealed.platform,
			requestedAt: new Date(this.now()).toISOString(),
			expiresAt: offer.expiresAt,
			challenge: sealed.challenge,
			deviceKey: sealed.deviceKey,
			approvalKey: envelope.approval
		};
	}
	private miss(offer: Offer): null {
		const limit = this.options.attempts ?? remoteLimits.pairingAttempts;
		if (++offer.misses >= limit) this.current = null;
		return null;
	}
	private live(): Offer | null {
		if (this.current && Date.parse(this.current.expiresAt) <= this.now()) this.current = null;
		return this.current;
	}
	private now(): number {
		return this.options.now?.() ?? Date.now();
	}
}
