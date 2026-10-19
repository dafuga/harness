import { SecureFailure } from '../models/RemoteSecure.types';
import type { SecureDirection } from '../models/RemoteSecure.types';
import { cryptoSource, fromBase64Url, remoteBytes, toBase64Url } from './remoteBytes';

export interface SealContext {
	key: CryptoKey;
	direction: SecureDirection;
	counter: number;
	more: boolean;
}

/** Four zero bytes, then the counter as an unsigned 64-bit big-endian integer. */
function nonce(counter: number): Uint8Array {
	const bytes = new Uint8Array(12);
	new DataView(bytes.buffer).setBigUint64(4, BigInt(counter));
	return bytes;
}
function parameters(context: SealContext) {
	const { direction, counter, more } = context;
	return {
		name: 'AES-GCM',
		iv: cryptoSource(nonce(counter)),
		additionalData: cryptoSource(
			remoteBytes(`harness-remote/v1/${direction}/${counter}/${more ? '1' : '0'}`)
		),
		tagLength: 128
	};
}
/** AES-256-GCM. The result is base64url of the ciphertext followed by its 16-byte tag. */
export async function sealPacket(context: SealContext, plaintext: Uint8Array): Promise<string> {
	const sealed = await crypto.subtle.encrypt(
		parameters(context),
		context.key,
		cryptoSource(plaintext)
	);
	return toBase64Url(new Uint8Array(sealed));
}
/** Throws a `tag` failure for another key, direction, counter, flag or any changed byte. */
export async function openPacket(context: SealContext, data: string): Promise<Uint8Array> {
	try {
		const sealed = cryptoSource(fromBase64Url(data));
		return new Uint8Array(await crypto.subtle.decrypt(parameters(context), context.key, sealed));
	} catch {
		throw new SecureFailure('tag');
	}
}
