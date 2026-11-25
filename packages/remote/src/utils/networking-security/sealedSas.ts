// @harness-uid u_knfxwodeve
import type { SealedEnrollKeys } from '../../models/networking-security/Sealed.types';
import { SealedError } from '../../models/networking-security/SealedError';
import { concatBytes, cryptoSource, remoteBytes, toHex } from './remoteBytes';

async function digest(label: string, ...parts: Uint8Array[]): Promise<Uint8Array> {
	const input = concatBytes(remoteBytes(label), ...parts);
	return new Uint8Array(await crypto.subtle.digest('SHA-256', cryptoSource(input)));
}

function checkKeys(keys: SealedEnrollKeys, ...nonces: Uint8Array[]): void {
	if (keys.kemPublic.length !== 65 || keys.signingPublic.length !== 65)
		throw new SealedError('Enrollment keys must be uncompressed P-256 points.');
	if (nonces.some((nonce) => nonce.length !== 32))
		throw new SealedError('Nonces must be 32 bytes.');
}

/**
 * Step 1, new device: commits to its keys and a secret nonce before it sees the approver's nonce,
 * so a server in the middle cannot grind keys to match the code.
 */
export async function sealedEnrollCommit(
	keys: SealedEnrollKeys,
	nonce: Uint8Array
): Promise<string> {
	checkKeys(keys, nonce);
	const hash = await digest(
		'harness/sealed/v1/commit-enroll\0',
		keys.kemPublic,
		keys.signingPublic,
		nonce
	);
	return toHex(hash);
}

/** Step 3, approver: the revealed nonce must open the commitment it received in step 1. */
export async function checkEnrollCommit(
	keys: SealedEnrollKeys,
	nonce: Uint8Array,
	commitment: string
): Promise<boolean> {
	return (await sealedEnrollCommit(keys, nonce)) === commitment;
}

/**
 * The 6-digit code both screens show: SHA-256 over the new device's keys, the approver's signing
 * key and both nonces. Daniel approves only when the two codes match.
 */
export async function sealedSas(input: {
	request: SealedEnrollKeys;
	requestNonce: Uint8Array;
	approverSigningPublic: Uint8Array;
	approverNonce: Uint8Array;
}): Promise<string> {
	checkKeys(input.request, input.requestNonce, input.approverNonce);
	if (input.approverSigningPublic.length !== 65)
		throw new SealedError('Approver key must be 65 bytes.');
	const hash = await digest(
		'harness/sealed/v1/sas\0',
		input.request.kemPublic,
		input.request.signingPublic,
		input.approverSigningPublic,
		input.requestNonce,
		input.approverNonce
	);
	const value = new DataView(hash.buffer).getUint32(0) % 1_000_000;
	return value.toString().padStart(6, '0');
}
