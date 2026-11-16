// @harness-uid u_yy3k3smxbp
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

/**
 * Anything JSON.stringify encodes. Objects stay open because a recursive JSON type would
 * reject interfaces such as RemoteGrant, which have no index signature.
 */
export type PairingValue = string | number | boolean | null | object;
