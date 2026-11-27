// @harness-uid u_xjwbsgtokn
import { SealedError } from '../../models/networking-security/SealedError';

const smallest = 256,
	step = 64 * 1024;

/** The padded size for `length` plaintext bytes plus the 4-byte length prefix. */
export function sealedBucket(length: number): number {
	const needed = length + 4;
	if (needed > step) return Math.ceil(needed / step) * step;
	let bucket = smallest;
	while (bucket < needed) bucket *= 2;
	return bucket;
}

/**
 * Hides exact sizes from the server: a big-endian u32 length, the bytes, then zeros up to the next
 * bucket (256 B doubling to 64 KiB, then 64 KiB steps).
 */
export function sealedPadding(bytes: Uint8Array): Uint8Array {
	const padded = new Uint8Array(sealedBucket(bytes.length));
	new DataView(padded.buffer).setUint32(0, bytes.length);
	padded.set(bytes, 4);
	return padded;
}

/** The original bytes. A length past the end or non-zero padding is refused. */
export function sealedUnpadding(padded: Uint8Array): Uint8Array {
	if (padded.length < 4) throw new SealedError('Padded plaintext is too short.');
	const length = new DataView(padded.buffer, padded.byteOffset, padded.length).getUint32(0);
	if (length > padded.length - 4) throw new SealedError('Padded length is out of range.');
	if (padded.subarray(4 + length).some((byte) => byte !== 0))
		throw new SealedError('Padding is not zero.');
	return padded.slice(4, 4 + length);
}
