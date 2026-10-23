/** The one-time offer a computer shows as a QR code: what a phone asks with, and no credential. */
export interface PairingOffer {
	origin: string;
	hostId: string;
	pairingId: string;
	code: string;
	expiresAt: string;
}

/** Where the relay of an offer is: on the internet, or on the machine of a development fixture. */
export type OfferEnvironment = 'production' | 'local';

/** Why a scanned text is not an offer this build may ask with. */
export type OfferRefusal = 'invalid' | 'unsupported' | 'environment' | 'expired';

export interface OfferReading {
	now: number;
	/** The environments this build accepts. */
	environments: readonly OfferEnvironment[];
}

export type OfferRead = { offer: PairingOffer } | { refused: OfferRefusal };
