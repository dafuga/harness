import { expect, test } from 'vitest';
import {
	checkEnrollCommit,
	sealedEnrollCommit,
	sealedSas
} from '../../../src/utils/networking-security/sealedSas';
import { sealedDevice } from '../../../src/utils/networking-security/sealedDevice';

const nonce = () => crypto.getRandomValues(new Uint8Array(32));

test('both sides compute the same 6-digit code from the same keys and nonces', async () => {
	const request = await sealedDevice(),
		approver = await sealedDevice();
	const input = {
		request: request,
		requestNonce: nonce(),
		approverSigningPublic: approver.signingPublic,
		approverNonce: nonce()
	};
	const code = await sealedSas(input);
	expect(code).toMatch(/^\d{6}$/);
	expect(await sealedSas({ ...input })).toBe(code);
	const substitute = await sealedDevice();
	expect(await sealedSas({ ...input, request: substitute })).not.toBe(code);
	expect(await sealedSas({ ...input, approverSigningPublic: substitute.signingPublic })).not.toBe(
		code
	);
});

test('the reveal must open the commitment the new device sent first', async () => {
	const request = await sealedDevice(),
		secret = nonce();
	const commitment = await sealedEnrollCommit(request, secret);
	expect(await checkEnrollCommit(request, secret, commitment)).toBe(true);
	expect(await checkEnrollCommit(request, nonce(), commitment)).toBe(false);
	expect(await checkEnrollCommit(await sealedDevice(), secret, commitment)).toBe(false);
	await expect(sealedEnrollCommit(request, new Uint8Array(8))).rejects.toThrow();
});
