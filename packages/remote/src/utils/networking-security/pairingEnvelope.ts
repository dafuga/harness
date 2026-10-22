import {
	bytesText,
	concatBytes,
	cryptoSource,
	fromBase64Url,
	remoteBytes,
	sha256,
	toBase64Url
} from './remoteBytes';
import { aesKey, deriveBytes } from './remoteKeys';

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

/** Two single-use keys: one seals the phone's request, the other the host's approval. */
export async function pairingEnvelope(context: PairingContext): Promise<PairingKeys> {
	const label = remoteBytes(`harness-remote/v1/pairing\n${context.hostId}\n${context.pairingId}\n`);
	const salt = await sha256(concatBytes(label, context.ephemeralKey, context.hostKey));
	const okm = await deriveBytes(context.secret, salt, 'harness-remote/v1/pairing-keys', 64);
	return { request: await aesKey(okm.subarray(0, 32)), approval: await aesKey(okm.subarray(32)) };
}
/** Each key seals exactly one message, so the nonce is twelve zero bytes. */
function parameters(kind: PairingKind) {
	return {
		name: 'AES-GCM',
		iv: cryptoSource(new Uint8Array(12)),
		additionalData: cryptoSource(remoteBytes(`harness-remote/v1/pairing-${kind}`)),
		tagLength: 128
	};
}
export async function sealPairing(
	key: CryptoKey,
	kind: PairingKind,
	value: unknown
): Promise<string> {
	const plain = cryptoSource(remoteBytes(JSON.stringify(value)));
	return toBase64Url(new Uint8Array(await crypto.subtle.encrypt(parameters(kind), key, plain)));
}
/** Throws for another key, another purpose, or any changed byte. */
export async function openPairing(
	key: CryptoKey,
	kind: PairingKind,
	sealed: string
): Promise<unknown> {
	const plain = await crypto.subtle.decrypt(
		parameters(kind),
		key,
		cryptoSource(fromBase64Url(sealed))
	);
	return JSON.parse(bytesText(new Uint8Array(plain))) as unknown;
}
