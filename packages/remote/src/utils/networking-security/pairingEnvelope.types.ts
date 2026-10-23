export interface PairingContext {
	hostId: string;
	pairingId: string;
	/** The phone's one-time public key for this pairing. */
	ephemeralKey: Uint8Array;
	hostKey: Uint8Array;
	/** ECDH of that ephemeral key with the host's static key. */
	secret: Uint8Array;
}

export type PairingKind = 'request' | 'approval';

export interface PairingKeys {
	request: CryptoKey;
	approval: CryptoKey;
}
