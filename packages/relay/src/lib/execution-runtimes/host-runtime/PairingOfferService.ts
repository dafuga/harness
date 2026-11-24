// @harness-uid u_m6g57qzeqs
import type { Approval } from './PairingOfferService.types';
import { remoteLimits, safeEqual } from '../../../../../remote/src/index';
import type { RelayErrorCode, RelayPairingRequest } from '../../../../../remote/src/index';
import type { HostStorageAdapter } from './HostStorageAdapter';
import { relayConfig } from '../../../configs/networking-security/relayConfig';
import type { PairingRecord } from '../../../models/networking-security/RelayHost.types';

/** The side of a pairing that belongs to the host: it offers, approves, denies and closes. */
export class PairingOfferService {
	constructor(private readonly store: HostStorageAdapter) {}

	/** An offer that exists and has not expired. One that expired is deleted here. */
	live(pairingId: string): PairingRecord | undefined {
		const pairing = this.store.pairing(pairingId);
		if (!pairing || pairing.expiresAt > Date.now()) return pairing;
		this.store.removePairing(pairingId);
		return undefined;
	}

	/** Opens an offer that ends when the host says, and in five minutes at the latest. */
	async open(pairingId: string, expiresAt: string): Promise<RelayErrorCode | undefined> {
		const now = Date.now();
		const end = Math.min(Date.parse(expiresAt), now + remoteLimits.pairingTtlMs);
		if (!(end > now)) return 'invalid-input';
		if (this.live(pairingId)) return 'pairing-unavailable';
		const held = this.store.pairings().filter((pairing) => pairing.expiresAt > now);
		if (held.length >= relayConfig.openPairings) return 'rate-limited';
		this.store.savePairing({ pairingId, state: 'open', expiresAt: end, attempts: 0 });
		await this.schedule();
		return undefined;
	}

	/** An authenticated request is installed in one turn and cannot be replaced by a public request. */
	async openAccount(
		pairingId: string,
		body: RelayPairingRequest
	): Promise<PairingRecord | undefined> {
		const now = Date.now();
		const held = this.store.pairings().filter((pairing) => pairing.expiresAt > now);
		if (
			this.live(pairingId) ||
			held.length >= relayConfig.openPairings ||
			held.some((pairing) => pairing.account && pairing.state === 'requested')
		)
			return undefined;
		const { challenge, ...request } = body;
		const record: PairingRecord = {
			pairingId,
			state: 'requested',
			expiresAt: now + remoteLimits.pairingTtlMs,
			attempts: 1,
			account: true,
			request,
			challenge
		};
		this.store.savePairing(record);
		await this.schedule();
		return record;
	}

	/** Keeps the sealed approval for the one request the host approved. The request is dropped. */
	approve(approval: Approval): RelayErrorCode | undefined {
		const pairing = this.live(approval.pairingId);
		if (!pairing) return 'not-found';
		if (pairing.state !== 'requested') return 'pairing-unavailable';
		const { pairingId, expiresAt, attempts, challenge } = pairing;
		/* The approval is for one request. A later request that replaced it is not approved. */
		const bound = challenge && approval.challenge && safeEqual(challenge, approval.challenge);
		if (!bound) return 'pairing-unavailable';
		const approved = { deviceId: approval.deviceId, approval: approval.sealed };
		this.store.savePairing({
			pairingId,
			state: 'approved',
			expiresAt,
			attempts,
			challenge,
			...(pairing.account && { account: pairing.account }),
			...approved
		});
		return undefined;
	}

	deny(pairingId: string): RelayErrorCode | undefined {
		const pairing = this.live(pairingId);
		if (!pairing) return 'not-found';
		if (pairing.state !== 'open' && pairing.state !== 'requested') return 'pairing-unavailable';
		const { expiresAt, attempts } = pairing;
		this.store.savePairing({ pairingId, state: 'denied', expiresAt, attempts });
		return undefined;
	}

	async close(pairingId: string): Promise<undefined> {
		this.store.removePairing(pairingId);
		await this.schedule();
		return undefined;
	}

	/** The alarm: deletes what expired a while ago and waits for the next offer to end. */
	async sweep(): Promise<void> {
		const before = Date.now() - relayConfig.sweepDelayMs;
		for (const pairing of this.store.pairings()) {
			if (pairing.expiresAt <= before) this.store.removePairing(pairing.pairingId);
		}
		await this.schedule();
	}

	private async schedule(): Promise<void> {
		const ends = this.store.pairings().map((pairing) => pairing.expiresAt);
		const next = ends.length > 0 ? Math.min(...ends) + relayConfig.sweepDelayMs : undefined;
		await this.store.alarmAt(next);
	}
}
