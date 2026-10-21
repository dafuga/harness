import { canonicalJson } from '../../../../../src/utils/canonicalJson';
export function hubJson(bytes: Uint8Array): unknown {
	try {
		return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
	} catch {
		throw Object.assign(new Error('Invalid committed artifact'), { code: 'artifact-corrupt' });
	}
}
export async function hubHash(value: Uint8Array | string): Promise<string> {
	const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
	return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
export async function hubContractHash(value: unknown) {
	return hubHash(canonicalJson(value));
}
export function hubFail(code = 'artifact-corrupt'): never {
	throw Object.assign(new Error('Harness artifact unavailable'), { code });
}
export function hubFile(value: string) {
	if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(value) || value.includes('..'))
		return hubFail('invalid-path');
	return value;
}
