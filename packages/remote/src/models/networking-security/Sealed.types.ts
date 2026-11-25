// @harness-uid u_lfrxo3gwh3
/** A JSON-serializable value that a record seals or the chain signs. */
export type SealedJsonValue = string | number | boolean | null | object;

/** Scope keys of one epoch, imported as keys WebCrypto will not export again. */
export interface ScopeKeys {
	/** 16 random bytes; `account` and every project scope have their own. */
	scopeId: Uint8Array;
	epoch: number;
	/** HKDF input for per-object and per-stream AES-256-GCM keys. */
	dataKey: CryptoKey;
	/** HMAC-SHA256 key for opaque object ids, the same in every epoch of a scope. */
	indexKey: CryptoKey;
	/** SHA-256 over both keys and their scope and epoch, as recorded in the device chain. */
	commitment: Uint8Array;
}

/** Freshly made or just unwrapped key bytes. Import them at once and drop the bytes. */
export interface RawScopeKeys {
	scopeId: Uint8Array;
	epoch: number;
	dataKey: Uint8Array;
	indexKey: Uint8Array;
}

/** The authenticated header of a sealed record. */
export interface SealedRecordHeader {
	scopeId: Uint8Array;
	epoch: number;
	/** 32 bytes: an opaque id from `sealedObjectId` or random for op-log entries. */
	objectId: Uint8Array;
	/** Grows with every write of the same object; clients refuse an older one. */
	revision: bigint;
}

export interface SealedFrameHeader {
	scopeId: Uint8Array;
	epoch: number;
	/** 16 random bytes, one per session stream. */
	streamId: Uint8Array;
	/** Frame number within the stream, from 0; never reused under one stream key. */
	counter: bigint;
}

export type SealedRole = 'admin' | 'bot' | 'recovery';

/** A device's own keys. Private halves are non-extractable unless made for the recovery blob. */
export interface SealedDeviceKeys {
	deviceId: string;
	kem: CryptoKeyPair;
	signing: CryptoKeyPair;
	/** Uncompressed P-256 points, 65 bytes each. */
	kemPublic: Uint8Array;
	signingPublic: Uint8Array;
}

/** A device as the chain lists it. Keys are base64url uncompressed points; scopes base64url ids. */
export interface SealedDevicePublic {
	deviceId: string;
	kemPublic: string;
	signingPublic: string;
	role: SealedRole;
	scopes: string[];
}

export interface SealedScopeCommitment {
	scope: string;
	epoch: number;
	commitment: string;
}

export type SealedChainBody =
	| {
			type: 'genesis';
			account: string;
			devices: SealedDevicePublic[];
			scopes: SealedScopeCommitment[];
	  }
	| { type: 'enroll'; device: SealedDevicePublic }
	| { type: 'revoke'; device: string }
	| { type: 'scope'; commitment: SealedScopeCommitment; devices: string[] }
	| { type: 'rotate'; commitment: SealedScopeCommitment };

export interface UnsignedChainEntry {
	seq: number;
	/** Hex SHA-256 of the previous signed entry's canonical bytes; empty for genesis. */
	prev: string;
	at: number;
	by: string;
	body: SealedChainBody;
}

export interface SealedChainEntry extends UnsignedChainEntry {
	/** Base64url raw `r||s` ECDSA P-256 SHA-256 signature. */
	sig: string;
}

/** What a client remembers so the server cannot roll it back or fork it. */
export interface SealedChainPin {
	seq: number;
	head: string;
}

export interface SealedChainDevice extends SealedDevicePublic {
	active: boolean;
}

export interface SealedChainScope {
	epoch: number;
	/** Base64url commitment per epoch. */
	commitments: Record<number, string>;
	/** A device holding this scope was revoked after its newest epoch; rotate before writing. */
	stale: boolean;
}

/** The verified result of a whole chain. */
export interface SealedChainState {
	account: string;
	seq: number;
	head: string;
	devices: Record<string, SealedChainDevice>;
	scopes: Record<string, SealedChainScope>;
}

/** A scope key bundle wrapped for one device. Its keys are checked against the chain. */
export interface SealedGrant {
	account: string;
	scope: string;
	epoch: number;
	device: string;
	/** Base64url HPKE encapsulated key, 65 bytes. */
	enc: string;
	/** Base64url HPKE ciphertext of dataKey ‖ indexKey. */
	ct: string;
}

/** Public request keys of a device waiting for approval. */
export interface SealedEnrollKeys {
	kemPublic: Uint8Array;
	signingPublic: Uint8Array;
}
