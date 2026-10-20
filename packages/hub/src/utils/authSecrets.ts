import { base64url } from 'jose';

export const encoder = new TextEncoder();

export interface AuthSecrets {
	/** Keyed lookup hash, stored in place of an opaque secret. */
	hash(purpose: string, value: string): Promise<string>;
	seal(plain: string, context: string): Promise<string>;
	/** Null when the key, the context or the ciphertext does not match. */
	open(sealed: string, context: string): Promise<string | null>;
}

export function randomToken(bytes = 32): string {
	return base64url.encode(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** base64url(SHA-256(value)): the S256 transform of RFC 7636. */
export async function sha256Url(value: string): Promise<string> {
	return base64url.encode(
		new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
	);
}

/** Compares every character of equal-length strings, so content does not change the timing. */
export function safeEqual(left: string, right: string): boolean {
	if (left.length !== right.length) return false;
	let difference = 0;
	for (let index = 0; index < left.length; index++) {
		difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}
	return difference === 0;
}

export { authSecrets } from '../lib/server/auth/authSecrets';
export { userCode, normalizeCode } from '../lib/server/auth/native-handoff-service/authSecrets';
export { emailCode } from '../services/email-proof-service/authSecrets';
