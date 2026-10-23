import type { RemoteGrant } from './Remote.types';

/** A P-256 key-agreement pair. `publicKey` is the 65-byte X9.63 uncompressed point. */
export interface RemoteKeyPair {
	publicKey: Uint8Array;
	privateKey: CryptoKey;
}

/** How a pair is kept at rest (encrypted by the OS store): both values base64url. */
export interface StoredRemoteKeys {
	d: string;
	publicKey: string;
}

export type SecureRole = 'device' | 'host';

export type SecureDirection = 'd2h' | 'h2d';

export interface SessionKeys {
	send: CryptoKey;
	receive: CryptoKey;
}

export interface SecureHello {
	type: 'hello';
	version: 1;
	deviceId: string;
	ephemeralKey: string;
	nonce: string;
}

export interface SecureAccept {
	type: 'accept';
	version: 1;
	ephemeralKey: string;
	nonce: string;
	generation: number;
}

export interface SecureReject {
	type: 'reject';
	reason: 'revoked' | 'unknown-device' | 'version' | 'busy';
}

export interface SecureSealed {
	type: 'sealed';
	counter: number;
	more: boolean;
	data: string;
}

/** Everything a relay forwards between a device and its host. */
export type SecurePacket = SecureHello | SecureAccept | SecureReject | SecureSealed;

/** What a phone seals to the host key when it asks to be paired. */
export interface PairingSecret {
	code: string;
	deviceKey: string;
	deviceName: string;
	platform: 'ios' | 'test';
	challenge: string;
}

/** What the host seals back once the person approved that exact device key. */
export interface PairingApproval {
	deviceId: string;
	hostName: string;
	generation: number;
	grant: RemoteGrant;
}

export type SecureFailureReason = 'state' | 'packet' | 'counter' | 'tag' | 'size';
export { SecureFailure } from './RemoteSecureValues';
