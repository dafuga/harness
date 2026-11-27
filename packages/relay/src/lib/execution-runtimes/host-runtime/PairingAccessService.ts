// @harness-uid u_qxg2ctyvds
import type { RelayPairingPoll, RelayPairingRequest } from '../../../../../remote/src/index';
import type { HostStorageAdapter } from './HostStorageAdapter';
import type { HostLinkService } from './HostLinkService';
import type { PairingOfferService } from './PairingOfferService';

/** The side of a pairing that belongs to a phone signed in to the account. */
export class PairingAccessService {
	constructor(
		private readonly store: HostStorageAdapter,
		private readonly offers: PairingOfferService,
		private readonly link: HostLinkService
	) {}

	/** What a phone that polls is told. An offer that expired says so once, and is gone. */
	poll(pairingId: string): RelayPairingPoll | undefined {
		const stored = this.store.pairing(pairingId);
		if (!stored) return undefined;
		const pairing = this.offers.live(pairingId);
		return { state: pairing ? pairing.state : 'expired', expiresAt: iso(stored.expiresAt) };
	}

	heldBy(pairingId: string, holder: string): boolean {
		return this.store.pairing(pairingId)?.holder === holder && !this.store.revokedHolder(holder);
	}

	async requestAccount(
		pairingId: string,
		request: RelayPairingRequest,
		holder?: string
	): Promise<RelayPairingPoll | undefined> {
		const registration = this.store.host()?.credentialHash;
		const offer = await this.offers.openAccount(pairingId, request, holder);
		if (!offer || !registration || this.store.host()?.credentialHash !== registration)
			return undefined;
		const expiresAt = iso(offer.expiresAt);
		if (
			!this.link.toHost({
				type: 'pairing-request',
				pairingId,
				account: true,
				...(holder && { holder }),
				expiresAt,
				...request
			})
		) {
			await this.offers.close(pairingId);
			return undefined;
		}
		return { state: 'requested', expiresAt };
	}
}

function iso(time: number): string {
	return new Date(time).toISOString();
}
