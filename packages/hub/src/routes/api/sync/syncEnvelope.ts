import { fromBase64Url, toBase64Url } from './syncBase64';
import type { RecordHeader } from './syncEnvelope.types';

/** `0x01 ‖ scope 16 ‖ epoch u32 ‖ object id 32 ‖ revision u64 ‖ salt 16 ‖ nonce 12`, then ciphertext. */
const headerLength = 61;
const minimum = headerLength + 16 + 12 + 16;

/** Reads ids from the header. Length and header only: the ciphertext is never looked at. */
export function recordHeader(envelope: string): RecordHeader | null {
	const bytes = fromBase64Url(envelope);
	if (!bytes || bytes.length < minimum || bytes[0] !== 1) return null;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
	const revision = view.getBigUint64(53);
	return {
		scope: toBase64Url(bytes.slice(1, 17)),
		epoch: view.getUint32(17),
		objectId: toBase64Url(bytes.slice(21, 53)),
		revision: revision <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(revision) : null,
		size: bytes.length,
		bytes
	};
}
