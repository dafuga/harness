import { expect, test } from 'vitest';
import { SealedError } from '../../../src/models/networking-security/SealedError';
import {
	sealedBucket,
	sealedPadding,
	sealedUnpadding
} from '../../../src/utils/networking-security/sealedPadding';

test('sizes round up to 256 B doubling buckets, then 64 KiB steps', () => {
	expect(sealedBucket(0)).toBe(256);
	expect(sealedBucket(252)).toBe(256);
	expect(sealedBucket(253)).toBe(512);
	expect(sealedBucket(65_532)).toBe(65_536);
	expect(sealedBucket(65_533)).toBe(131_072);
	expect(sealedBucket(200_000)).toBe(262_144);
});

test('padding round-trips and hides lengths inside one bucket', () => {
	const short = sealedPadding(new Uint8Array([1, 2, 3])),
		longer = sealedPadding(new Uint8Array(200).fill(7));
	expect(short).toHaveLength(256);
	expect(longer).toHaveLength(256);
	expect([...sealedUnpadding(short)]).toEqual([1, 2, 3]);
	expect(sealedUnpadding(longer)).toEqual(new Uint8Array(200).fill(7));
});

test('a length past the end or non-zero padding is refused', () => {
	const padded = sealedPadding(new Uint8Array([9]));
	const wrongLength = padded.slice();
	new DataView(wrongLength.buffer).setUint32(0, 300);
	expect(() => sealedUnpadding(wrongLength)).toThrow(SealedError);
	const dirty = padded.slice();
	dirty[200] = 1;
	expect(() => sealedUnpadding(dirty)).toThrow(SealedError);
	expect(() => sealedUnpadding(new Uint8Array(3))).toThrow(SealedError);
});
