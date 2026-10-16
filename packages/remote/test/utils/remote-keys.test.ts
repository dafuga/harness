import { expect, test } from 'vitest';
import { toBase64Url, toHex } from '../../src/utils/remoteBytes';
import {
	deriveBytes,
	exportRemoteKeys,
	importRemoteKeys,
	remoteKeys,
	sharedSecret
} from '../../src/utils/remoteKeys';
import { vectors } from '../support/vectors';

test('generated keys are uncompressed P-256 points that agree on a shared secret', async () => {
	const a = await remoteKeys(),
		b = await remoteKeys();
	expect(a.publicKey).toHaveLength(65);
	expect(a.publicKey[0]).toBe(4);
	const secret = await sharedSecret(a.privateKey, b.publicKey);
	expect(secret).toHaveLength(32);
	expect(toHex(await sharedSecret(b.privateKey, a.publicKey))).toBe(toHex(secret));
});
test('stored keys import to the same public point and export back', async () => {
	const pair = await importRemoteKeys(vectors.hostStatic);
	expect(toBase64Url(pair.publicKey)).toBe(vectors.hostStatic.publicKey);
	expect(await exportRemoteKeys(pair)).toEqual(vectors.hostStatic);
	await expect(
		importRemoteKeys({ d: vectors.hostStatic.d, publicKey: vectors.deviceStatic.publicKey })
	).rejects.toThrow();
});
test('a point that is not on the curve is refused', async () => {
	const pair = await remoteKeys(),
		bad = new Uint8Array(65).fill(1);
	bad[0] = 4;
	await expect(sharedSecret(pair.privateKey, bad)).rejects.toThrow();
	await expect(sharedSecret(pair.privateKey, pair.publicKey.subarray(0, 33))).rejects.toThrow();
});
test('HKDF-SHA256 matches RFC 5869 test case 1', async () => {
	const ikm = new Uint8Array(22).fill(0x0b),
		salt = Uint8Array.from({ length: 13 }, (_, index) => index),
		info = Uint8Array.from({ length: 10 }, (_, index) => 0xf0 + index);
	expect(toHex(await deriveBytes(ikm, salt, info, 42))).toBe(
		'3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865'
	);
});
