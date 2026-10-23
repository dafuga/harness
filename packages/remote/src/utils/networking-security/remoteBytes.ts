import type { CryptoSource } from './remoteBytes.types';
const encoder = new TextEncoder();

const decoder = new TextDecoder('utf-8', { fatal: true });

const base64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** WebCrypto takes these bytes as they are; the cast only names the buffer type it expects. */
export function cryptoSource(bytes: Uint8Array): CryptoSource {
	return bytes as unknown as CryptoSource;
}

/** UTF-8 bytes of a text. */
export function remoteBytes(text: string): Uint8Array {
	return encoder.encode(text);
}

/** Strict UTF-8: malformed bytes throw instead of becoming replacement characters. */
export function bytesText(bytes: Uint8Array): string {
	return decoder.decode(bytes);
}

export function toBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let offset = 0; offset < bytes.length; offset += 0x8000)
		binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
	return btoa(binary);
}

export function fromBase64(text: string): Uint8Array {
	if (!base64.test(text)) throw new Error('Invalid base64.');
	const binary = atob(text),
		bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
	return bytes;
}

/** RFC 4648 section 5, without padding. */
export function toBase64Url(bytes: Uint8Array): string {
	return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array {
	if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1)
		throw new Error('Invalid base64url.');
	const padding = '='.repeat((4 - (text.length % 4)) % 4);
	return fromBase64(text.replace(/-/g, '+').replace(/_/g, '/') + padding);
}

export function toHex(bytes: Uint8Array): string {
	return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
	const bytes = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		bytes.set(part, offset);
		offset += part.length;
	}
	return bytes;
}

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
	return new Uint8Array(await crypto.subtle.digest('SHA-256', cryptoSource(bytes)));
}

export function randomBytes(length: number): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(length));
}

/** Compares every character of equal-length strings, so content does not change the timing. */
export function safeEqual(left: string, right: string): boolean {
	if (left.length !== right.length) return false;
	let difference = 0;
	for (let index = 0; index < left.length; index++)
		difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
	return difference === 0;
}

export { stableJson } from '../../services/networking-security/wire-session-service/remoteBytes';

export type { CryptoSource } from './remoteBytes.types';
