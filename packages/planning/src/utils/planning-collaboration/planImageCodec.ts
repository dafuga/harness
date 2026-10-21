import { Buffer } from 'node:buffer';
import { PNG } from 'pngjs';
import { fail } from './planData';
export function planImageCodec(bytes: Uint8Array): { width: number; height: number } {
	if (!(bytes instanceof Uint8Array) || bytes.length > 32 * 1024 * 1024 || bytes.length < 33)
		fail('invalid-image', 'Expected a complete PNG under 32 MiB');
	const buffer = Buffer.from(bytes);
	const width = buffer.readUInt32BE(16);
	const height = buffer.readUInt32BE(20);
	if (!width || !height || width * height > 32000000)
		fail('invalid-image', 'Image dimensions exceed limit');
	try {
		const result = PNG.sync.read(buffer, { checkCRC: true });
		return { width: result.width, height: result.height };
	} catch {
		return fail('invalid-image', 'PNG decoding failed');
	}
}
