import { fromBase64Url, randomBytes, remoteBytes, sha256, toBase64Url, toHex } from './remoteBytes';

/** Every identifier and encoded value of the protocol. Nothing else is accepted on a wire. */
export const remotePatterns = {
	hostId: /^[a-f0-9]{40}$/,
	deviceId: /^[a-f0-9]{40}$/,
	pairingId: /^[a-f0-9]{32}$/,
	connectionId: /^[a-f0-9]{32}$/,
	epoch: /^[a-f0-9]{32}$/,
	requestId: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
	/** base64url of a 65-byte uncompressed P-256 point. */
	key: /^[A-Za-z0-9_-]{87}$/,
	nonce: /^[A-Za-z0-9_-]{22}$/,
	credential: /^[A-Za-z0-9_-]{43}$/,
	challenge: /^[A-Za-z0-9_-]{43}$/,
	hash: /^[a-f0-9]{64}$/,
	/** A pairing envelope: never larger than a few kilobytes. */
	sealed: /^[A-Za-z0-9_-]{22,8192}$/,
	code: /^[A-HJ-NP-Z2-9]{8}$/,
	/** Only projects registered on the computer. A hosted project id never matches. */
	projectId: /^local-[a-f0-9]{64}$/
} as const;

/** `hostId` or `deviceId`: the first 40 hex of SHA-256 over the public key. Self-certifying. */
export async function remoteIdentity(publicKey: Uint8Array | string): Promise<string> {
	const bytes = typeof publicKey === 'string' ? fromBase64Url(publicKey) : publicKey;
	if (bytes.length !== 65 || bytes[0] !== 4)
		throw new Error('Expected an uncompressed P-256 public key.');
	return toHex(await sha256(bytes)).slice(0, 40);
}

export interface CredentialBinding {
	role: 'host' | 'device';
	hostId: string;
	deviceId?: string;
	credential: string;
}

/** What a relay stores in place of a credential: bound to the role and the identities. */
export async function credentialHash(binding: CredentialBinding): Promise<string> {
	const { role, hostId, deviceId = '', credential } = binding;
	const text = ['harness-remote/v1/credential', role, hostId, deviceId, credential].join('\n');
	return toHex(await sha256(remoteBytes(text)));
}

/** base64url(SHA-256(verifier)): the S256 transform of RFC 7636. */
export async function pkceChallenge(verifier: string): Promise<string> {
	return toBase64Url(await sha256(remoteBytes(verifier)));
}

export function randomId(bytes = 16): string {
	return toHex(randomBytes(bytes));
}

export function randomCredential(): string {
	return toBase64Url(randomBytes(32));
}

export function normalizeCode(value: string): string {
	return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export { pairingCode } from '../../../../desktop/src/services/remote-host-service/host-pairing-service/remoteIdentity';
export { requestDigest } from '../../services/networking-security/wire-session-service/remoteIdentity';
