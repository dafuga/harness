// @harness-uid u_dnehbxahjv
import type { RawScopeKeys, ScopeKeys } from '../../models/networking-security/Sealed.types';
import { SealedError } from '../../models/networking-security/SealedError';
import { concatBytes, cryptoSource, remoteBytes, toBase64Url } from './remoteBytes';

const commitLabel = remoteBytes('harness/sealed/v1/commit\0');

function u32(value: number): Uint8Array {
	if (!Number.isInteger(value) || value < 0 || value > 0xffffffff)
		throw new SealedError('Epoch is out of range.');
	const bytes = new Uint8Array(4);
	new DataView(bytes.buffer).setUint32(0, value);
	return bytes;
}

function random(length: number): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(length));
}

/** New key bytes for a scope: a fresh scope id at epoch 0, or the next epoch of `rotating`. */
export function newScopeKeys(rotating?: RawScopeKeys): RawScopeKeys {
	return {
		scopeId: rotating ? rotating.scopeId : random(16),
		epoch: rotating ? rotating.epoch + 1 : 0,
		dataKey: random(32),
		indexKey: rotating ? rotating.indexKey : random(32)
	};
}

/** SHA-256 over label ‖ scope id ‖ epoch ‖ data key ‖ index key. It binds the keys to the chain. */
export async function scopeCommitment(raw: RawScopeKeys): Promise<Uint8Array> {
	checkRaw(raw);
	const input = concatBytes(commitLabel, raw.scopeId, u32(raw.epoch), raw.dataKey, raw.indexKey);
	return new Uint8Array(await crypto.subtle.digest('SHA-256', cryptoSource(input)));
}

function checkRaw(raw: RawScopeKeys): void {
	if (raw.scopeId.length !== 16 || raw.dataKey.length !== 32 || raw.indexKey.length !== 32)
		throw new SealedError('Scope key sizes are wrong.');
}

/** Imports key bytes as non-extractable keys and computes their commitment. */
export async function sealedScopeKeys(raw: RawScopeKeys): Promise<ScopeKeys> {
	const commitment = await scopeCommitment(raw);
	const dataKey = await crypto.subtle.importKey('raw', cryptoSource(raw.dataKey), 'HKDF', false, [
		'deriveKey',
		'deriveBits'
	]);
	const indexKey = await crypto.subtle.importKey(
		'raw',
		cryptoSource(raw.indexKey),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	return { scopeId: raw.scopeId.slice(), epoch: raw.epoch, dataKey, indexKey, commitment };
}

/** HMAC-SHA256(indexKey, kind ‖ 0 ‖ local id): the same id every epoch, meaningless to the server. */
export async function sealedObjectId(
	keys: ScopeKeys,
	kind: string,
	localId: string
): Promise<Uint8Array> {
	if (kind.includes('\0')) throw new SealedError('Object kind cannot contain NUL.');
	const input = remoteBytes(`${kind}\0${localId}`);
	return new Uint8Array(await crypto.subtle.sign('HMAC', keys.indexKey, cryptoSource(input)));
}

/** The base64url scope id the chain and the server use. */
export function scopeName(keys: Pick<ScopeKeys, 'scopeId'>): string {
	return toBase64Url(keys.scopeId);
}

export { u32 as sealedU32 };
