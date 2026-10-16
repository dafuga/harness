import { expect, test } from 'vitest';
import {
	bytesText,
	concatBytes,
	fromBase64,
	fromBase64Url,
	randomBytes,
	remoteBytes,
	safeEqual,
	sha256,
	stableJson,
	toBase64,
	toBase64Url,
	toHex
} from '../../src/utils/remoteBytes';

test('text and base64 encodings round-trip, base64url without padding', () => {
	expect(bytesText(remoteBytes('héllo ✓'))).toBe('héllo ✓');
	expect(toBase64Url(new Uint8Array([251, 255, 254]))).toBe('-__-');
	expect([...fromBase64Url('-__-')]).toEqual([251, 255, 254]);
	expect(toBase64Url(new Uint8Array([1]))).toBe('AQ');
	expect(toBase64(new Uint8Array([1]))).toBe('AQ==');
	expect([...fromBase64('AQ==')]).toEqual([1]);
	expect(toHex(new Uint8Array([0, 15, 255]))).toBe('000fff');
	expect([...concatBytes(new Uint8Array([1]), new Uint8Array([2, 3]))]).toEqual([1, 2, 3]);
});
test('malformed encodings and invalid UTF-8 are refused', () => {
	expect(() => fromBase64Url('a+b/')).toThrow();
	expect(() => fromBase64Url('A')).toThrow();
	expect(() => fromBase64Url('AQ==')).toThrow();
	expect(() => fromBase64('not base64!')).toThrow();
	expect(() => bytesText(new Uint8Array([0xff, 0xfe]))).toThrow();
});
test('hashing, comparison and canonical JSON are deterministic', async () => {
	expect(toHex(await sha256(remoteBytes('abc')))).toBe(
		'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
	);
	expect(safeEqual('abc', 'abc')).toBe(true);
	expect(safeEqual('abc', 'abd')).toBe(false);
	expect(safeEqual('abc', 'abcd')).toBe(false);
	expect(stableJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: null } })).toBe(
		'{"a":{"c":null,"d":[2,{"y":2,"z":1}]},"b":1}'
	);
	expect(randomBytes(16)).toHaveLength(16);
	expect(toHex(randomBytes(16))).not.toBe(toHex(randomBytes(16)));
});
