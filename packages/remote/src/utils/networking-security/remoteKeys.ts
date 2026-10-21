import type {
	RemoteKeyPair,
	StoredRemoteKeys
} from '../../models/networking-security/RemoteSecure.types';
import { cryptoSource, fromBase64Url, remoteBytes, toBase64Url, toHex } from './remoteBytes';

const curve = { name: 'ECDH', namedCurve: 'P-256' } as const;

function point(bytes: Uint8Array): Uint8Array {
	if (bytes.length !== 65 || bytes[0] !== 4) throw new Error('Invalid P-256 public key.');
	return bytes;
}
/** A fresh P-256 key-agreement pair. */
export async function remoteKeys(): Promise<RemoteKeyPair> {
	const pair = await crypto.subtle.generateKey(curve, true, ['deriveBits']);
	const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
	return { publicKey, privateKey: pair.privateKey };
}
/** The 32-byte x coordinate of ECDH. An off-curve or malformed point throws. */
export async function sharedSecret(
	privateKey: CryptoKey,
	publicKey: Uint8Array
): Promise<Uint8Array> {
	const peer = await crypto.subtle.importKey(
		'raw',
		cryptoSource(point(publicKey)),
		curve,
		false,
		[]
	);
	return new Uint8Array(
		await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, privateKey, 256)
	);
}
/** Stored keys whose private scalar does not belong to the stored public point are refused. */
export async function importRemoteKeys(stored: StoredRemoteKeys): Promise<RemoteKeyPair> {
	const publicKey = point(fromBase64Url(stored.publicKey));
	const jwk = {
		kty: 'EC',
		crv: 'P-256',
		d: stored.d,
		x: toBase64Url(publicKey.subarray(1, 33)),
		y: toBase64Url(publicKey.subarray(33)),
		ext: true
	};
	const privateKey = await crypto.subtle.importKey('jwk', jwk, curve, true, ['deriveBits']);
	const probe = await remoteKeys();
	const mine = await sharedSecret(privateKey, probe.publicKey),
		theirs = await sharedSecret(probe.privateKey, publicKey);
	if (toHex(mine) !== toHex(theirs)) throw new Error('Stored key pair does not match.');
	return { publicKey, privateKey };
}
export async function exportRemoteKeys(pair: RemoteKeyPair): Promise<StoredRemoteKeys> {
	const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
	if (typeof jwk.d !== 'string') throw new Error('Private key cannot be exported.');
	return { d: jwk.d, publicKey: toBase64Url(pair.publicKey) };
}
/** HKDF-SHA256 (RFC 5869). */
export async function deriveBytes(
	ikm: Uint8Array,
	salt: Uint8Array,
	info: Uint8Array | string,
	length: number
): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey('raw', cryptoSource(ikm), 'HKDF', false, [
		'deriveBits'
	]);
	const parameters = {
		name: 'HKDF',
		hash: 'SHA-256',
		salt: cryptoSource(salt),
		info: cryptoSource(typeof info === 'string' ? remoteBytes(info) : info)
	};
	return new Uint8Array(await crypto.subtle.deriveBits(parameters, key, length * 8));
}
/** An AES-256-GCM key that cannot be exported again. */
export async function aesKey(bytes: Uint8Array): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', cryptoSource(bytes), 'AES-GCM', false, [
		'encrypt',
		'decrypt'
	]);
}
