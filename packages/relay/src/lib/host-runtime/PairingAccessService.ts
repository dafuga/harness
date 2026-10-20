import { remoteLimits } from '../../../../remote/src/index';
import type {
	RelayErrorCode,
	RelayPairingInfo,
	RelayPairingPoll,
	RelayPairingRequest
} from '../../../../remote/src/index';
import type { HostStorageAdapter } from './HostStorageAdapter';
import type { HostLinkService } from './HostLinkService';
import type { PairingOfferService } from './PairingOfferService';

/** The side of a pairing that belongs to a phone, which nobody has authenticated yet. */
export class PairingAccessService {
	constructor(
		private readonly store: HostStorageAdapter,
		private readonly offers: PairingOfferService,
		private readonly link: HostLinkService
	) {}

	/** Public ids, the host key the phone verifies them against, and the state. */
	info(pairingId: string): RelayPairingInfo | undefined {
		const host = this.store.host();
		const pairing = this.offers.live(pairingId);
		if (!host || !pairing) return undefined;
		const { hostId, hostKey } = host;
		return { hostId, pairingId, hostKey, state: pairing.state, expiresAt: iso(pairing.expiresAt) };
	}

	/** What a phone that polls is told. An offer that expired says so once, and is gone. */
	poll(pairingId: string): RelayPairingPoll | undefined {
		const stored = this.store.pairing(pairingId);
		if (!stored) return undefined;
		const pairing = this.offers.live(pairingId);
		return { state: pairing ? pairing.state : 'expired', expiresAt: iso(stored.expiresAt) };
	}

	/**
	 * Keeps the newest request of a phone, a limited number of times, and hands it to the host.
	 * When the host is away the request waits in storage and is handed over when it returns.
	 */
	request(pairingId: string, request: RelayPairingRequest): RelayPairingPoll | RelayErrorCode {
		const pairing = this.offers.live(pairingId);
		if (!pairing) return 'not-found';
		const asking = pairing.state === 'open' || pairing.state === 'requested';
		if (!asking || pairing.attempts >= remoteLimits.pairingAttempts) return 'pairing-unavailable';
		const { ephemeralKey, sealed, challenge } = request;
		this.store.savePairing({
			pairingId,
			state: 'requested',
			expiresAt: pairing.expiresAt,
			attempts: pairing.attempts + 1,
			request: { ephemeralKey, sealed },
			challenge
		});
		this.link.toHost({ type: 'pairing-request', pairingId, ephemeralKey, sealed, challenge });
		return { state: 'requested', expiresAt: iso(pairing.expiresAt) };
	}
}

function iso(time: number): string {
	return new Date(time).toISOString();
}
