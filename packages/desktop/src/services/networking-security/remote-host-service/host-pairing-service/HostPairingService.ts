// @harness-uid u_at4omr5js3
import type {
	Offer,
	HostPairingOptions,
	HostPairingOffer,
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
import {
	normalizeCode,
	randomId,
	remoteIdentity
} from '../../../../../../remote/src/utils/remoteIdentity';
import { pairingCode } from './remoteIdentity';
import { remotePatterns } from '../../../../../../remote/src/utils/remoteIdentity';
import { sharedSecret } from '../../../../../../remote/src/utils/remoteKeys';

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
		requestedAt: new Date(now).toISOString(),
		expiresAt: offer.expiresAt,
		challenge: sealed.challenge,
		deviceKey: sealed.deviceKey,
		approvalKey: envelope.approval
	};
}

/** The computer can receive an account request alongside its QR offer. Both need local approval. */
export class HostPairingService {
	private current: Offer | null = null;
	private account: Offer | null = null;
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
		const live = this.live(false);
		return live ? { pairingId: live.pairingId, code: live.code, expiresAt: live.expiresAt } : null;
	}
	requests(): RemotePairingRequest[] {
		return [this.live(true)?.request, this.live(false)?.request].flatMap((request) => {
			if (!request) return [];
			const { pairingId, deviceId, deviceName, platform, requestedAt, expiresAt } = request;
			return [{ pairingId, deviceId, deviceName, platform, requestedAt, expiresAt }];
		});
	}
	/** A relay-authenticated account offer uses an empty code, sealed to this Mac's key. */
	async receive(frame: HostPairingFrame): Promise<RemotePairingRequest | null> {
		const account = frame.account === true;
		const offer = account ? this.accountOffer(frame) : this.live(false);
		if (!offer || offer.pairingId !== frame.pairingId || offer.request) return null;
		const request = await this.opened(offer, frame).catch(() => null);
		if (this.live(account) !== offer || offer.request) return null;
		if (!request) return this.miss(offer, account);
		offer.request = request;
		return this.requests().find((item) => item.pairingId === frame.pairingId) ?? null;
	}
	/** Seals the grant to the key that asked. The offer is spent, whatever happens next. */
	async approve(
		pairingId: string,
		approval: { hostName: string; generation: number; grant: RemoteGrant; deviceId?: string }
	): Promise<HostPairingApproved> {
		const request = this.requested(pairingId)?.request;
		if (!request) throw new PairingRequestNotFoundError('There is no pairing request to approve.');
		const { deviceId: shown, ...granted } = approval;
		if (shown !== undefined && shown !== request.deviceId)
			throw new PairingPhoneMismatchError('This is not the phone that was shown.');
		this.clearRequest(pairingId);
		const { deviceId, deviceKey, deviceName, platform, challenge } = request;
		const sealed = await sealPairing(request.approvalKey, 'approval', { deviceId, ...granted });
		return { deviceId, deviceKey, deviceName, platform, sealed, challenge };
	}
	deny(pairingId: string): boolean {
		if (!this.requested(pairingId)?.request) return false;
		this.clearRequest(pairingId);
		return true;
	}
	closeOffer(): void {
		this.current = null;
	}
	close(): void {
		this.current = this.account = null;
	}
	private clearRequest(pairingId: string): void {
		if (this.account?.pairingId === pairingId) this.account = null;
		else this.closeOffer();
	}
	private requested(pairingId: string): Offer | undefined {
		return (
			[this.live(true), this.live(false)].find((offer) => offer?.pairingId === pairingId) ??
			undefined
		);
	}
	private accountOffer({ pairingId, expiresAt }: HostPairingFrame): Offer | null {
		const now = this.now(),
			end = Date.parse(expiresAt ?? '');
		if (!expiresAt || !(end > now && end <= now + remoteLimits.pairingTtlMs + 60_000)) return null;
		if (this.live(false)?.pairingId === pairingId) return null;
		return (
			this.live(true) ??
			(this.account = { pairingId, code: '', expiresAt, misses: 0, request: null })
		);
	}
	private opened(offer: Offer, frame: HostPairingFrame): Promise<Requested | null> {
		return openRequest(this.options, offer, frame, this.now());
	}
	private miss(offer: Offer, account: boolean): null {
		const limit = this.options.attempts ?? remoteLimits.pairingAttempts;
		if (account || ++offer.misses >= limit) this.clearRequest(offer.pairingId);
		return null;
	}
	private live(account: boolean): Offer | null {
		const offer = account ? this.account : this.current;
		if (!offer || Date.parse(offer.expiresAt) > this.now()) return offer;
		this.clearRequest(offer.pairingId);
		return null;
	}
	private now(): number {
		return this.options.now?.() ?? Date.now();
	}
}

export type {
	HostPairingOptions,
	HostPairingOffer,
	HostPairingFrame,
	HostPairingApproved
} from './HostPairingService.types';
