import { encoder, AuthSecrets } from '../../../utils/authSecrets';
import { base64url } from 'jose';

const SALT = 'harness-hub-auth-v1';

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
