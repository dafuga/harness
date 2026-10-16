import { base64url } from 'jose';

const encoder = new TextEncoder();
const SALT = 'harness-hub-auth-v1';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface AuthSecrets {
	/** Keyed lookup hash, stored in place of an opaque secret. */
	hash(purpose: string, value: string): Promise<string>;
	seal(plain: string, context: string): Promise<string>;
	/** Null when the key, the context or the ciphertext does not match. */
	open(sealed: string, context: string): Promise<string | null>;
}

async function derive(secret: string, info: string): Promise<ArrayBuffer> {
	const base = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, [
		'deriveBits'
	]);
	const params = { name: 'HKDF', hash: 'SHA-256', salt: encoder.encode(SALT) };
	return crypto.subtle.deriveBits({ ...params, info: encoder.encode(info) }, base, 256);
}

async function lookupKey(secret: string): Promise<CryptoKey> {
	const algorithm = { name: 'HMAC', hash: 'SHA-256' };
	return crypto.subtle.importKey('raw', await derive(secret, 'lookup'), algorithm, false, ['sign']);
}

async function sealKey(secret: string): Promise<CryptoKey> {
	const usages: KeyUsage[] = ['encrypt', 'decrypt'];
	return crypto.subtle.importKey('raw', await derive(secret, 'seal'), 'AES-GCM', false, usages);
}

function hex(bytes: ArrayBuffer): string {
	return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function unseal(key: CryptoKey, sealed: string, context: string): Promise<string | null> {
	const [version, iv, data, extra] = sealed.split('.');
	if (version !== 'v1' || !iv || !data || extra !== undefined) return null;
	try {
		const params = {
			name: 'AES-GCM',
			iv: new Uint8Array(base64url.decode(iv)),
			additionalData: encoder.encode(context)
		};
		const plain = await crypto.subtle.decrypt(params, key, new Uint8Array(base64url.decode(data)));
		return new TextDecoder('utf-8', { fatal: true }).decode(plain);
	} catch {
		return null;
	}
}

/** Derives separate lookup and sealing keys from the session secret with HKDF-SHA256. */
export function authSecrets(secret: string): AuthSecrets {
	let lookup: Promise<CryptoKey> | undefined;
	let sealing: Promise<CryptoKey> | undefined;
	const sealer = () => (sealing ??= sealKey(secret));
	return {
		async hash(purpose, value) {
			const key = await (lookup ??= lookupKey(secret));
			return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${purpose}\n${value}`)));
		},
		async seal(plain, context) {
			const iv = crypto.getRandomValues(new Uint8Array(12));
			const params = { name: 'AES-GCM', iv, additionalData: encoder.encode(context) };
			const data = await crypto.subtle.encrypt(params, await sealer(), encoder.encode(plain));
			return `v1.${base64url.encode(iv)}.${base64url.encode(new Uint8Array(data))}`;
		},
		async open(sealed, context) {
			return unseal(await sealer(), sealed, context);
		}
	};
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

/** Eight characters a person types from the desktop app into the approval page. */
export function userCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(8));
	const text = [...bytes].map((byte) => CODE_ALPHABET[byte & 31]).join('');
	return `${text.slice(0, 4)}-${text.slice(4)}`;
}

export function normalizeCode(value: string): string {
	return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Eight decimal digits, drawn without modulo bias. Eight, not six: a person who still holds a
 * Google account for an address they lost can ask for new codes every day.
 */
export function emailCode(): string {
	const draw = new Uint32Array(1);
	do crypto.getRandomValues(draw);
	while (draw[0] >= 4_200_000_000);
	return String(draw[0] % 100_000_000).padStart(8, '0');
}
