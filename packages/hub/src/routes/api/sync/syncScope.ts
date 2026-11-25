import { fromBase64Url } from './syncBase64';

/** A scope id as the API spells it: 16 bytes, base64url. */
export function isScopeId(value: unknown): value is string {
	if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(value)) return false;
	return fromBase64Url(value)?.length === 16;
}

/** An opaque object id: 32 bytes, base64url. */
export function isObjectId(value: unknown): value is string {
	if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) return false;
	return fromBase64Url(value)?.length === 32;
}
