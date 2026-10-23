import { base64url } from 'jose';

export const encoder = new TextEncoder();

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

export { authSecrets } from '../../lib/verification-evidence/server/auth/authSecrets';
export {
	userCode,
	normalizeCode
} from '../../lib/verification-evidence/server/auth/native-handoff-service/authSecrets';
export { emailCode } from '../../services/verification-evidence/email-proof-service/authSecrets';

export type { AuthSecrets } from './authSecrets.types';
