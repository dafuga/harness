import { createHash } from 'node:crypto';
import { toBase64 } from '../../../remote/src/index';
import type { RemoteBinary } from '../../../remote/src/index';

/** Media as a wire answer: base64 with the length and the hash a receiver checks before use. */
export function binaryAnswer(bytes: Uint8Array, mediaType = 'image/png'): RemoteBinary {
	return {
		encoding: 'base64',
		mediaType,
		byteLength: bytes.length,
		sha256: createHash('sha256').update(bytes).digest('hex'),
		data: toBase64(bytes)
	};
}
