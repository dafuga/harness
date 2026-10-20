import type { MediaFacts } from '../../utils/mediaFacts';
import { inflateSync } from 'node:zlib';

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const channels: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

const table = Array.from({ length: 256 }, (_, index) => {
	let value = index;
	for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
	return value >>> 0;
});

/** CRC-32 as PNG chunks use it. */
export function pngChecksum(bytes: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

/** Decodes enough of a capture to prove it is real media, and reports what it contains. */
export function mediaFacts(bytes: Buffer, mediaType: string): MediaFacts {
	if (mediaType === 'image/png') return pngFacts(bytes);
	if (mediaType === 'audio/wav' || mediaType === 'audio/x-wav') return wavFacts(bytes);
	return { error: `unsupported media type ${mediaType}` };
}

function pngFacts(bytes: Buffer): MediaFacts {
	if (!bytes.subarray(0, 8).equals(signature)) return { error: 'missing PNG signature' };
	const data: Buffer[] = [];
	let header: Buffer | undefined;
	for (let offset = 8; offset + 12 <= bytes.length; ) {
		const length = bytes.readUInt32BE(offset);
		const end = offset + 12 + length;
		if (end > bytes.length) break;
		const type = bytes.toString('latin1', offset + 4, offset + 8);
		if (pngChecksum(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) {
			return { error: `chunk ${type} fails its checksum` };
		}
		if (type === 'IHDR') header = bytes.subarray(offset + 8, end - 4);
		if (type === 'IDAT') data.push(bytes.subarray(offset + 8, end - 4));
		if (type === 'IEND') return header ? pixelFacts(header, data) : { error: 'missing IHDR chunk' };
		offset = end;
	}
	return { error: 'truncated before the IEND chunk' };
}

function pixelFacts(header: Buffer, data: Buffer[]): MediaFacts {
	const width = header.readUInt32BE(0);
	const height = header.readUInt32BE(4);
	const perPixel = (channels[header[9]] ?? 0) * header[8];
	if (header.length !== 13 || width === 0 || height === 0 || perPixel === 0) {
		return { error: 'invalid image header' };
	}
	let pixels: Buffer;
	try {
		pixels = inflateSync(Buffer.concat(data));
	} catch {
		return { error: 'pixel data cannot be decompressed' };
	}
	const expected = height * (1 + Math.ceil((width * perPixel) / 8));
	if (header[12] === 0 && pixels.length !== expected) {
		return { error: `pixel data does not match ${width}x${height}` };
	}
	return { kind: 'image', width, height };
}

/** Same container rules as the report store: PCM or 32-bit float, with real samples. */
function wavFacts(bytes: Buffer): MediaFacts {
	const riff = bytes.length >= 12 && bytes.toString('latin1', 0, 4) === 'RIFF';
	if (!riff || bytes.toString('latin1', 8, 12) !== 'WAVE')
		return { error: 'missing RIFF/WAVE header' };
	const declared = bytes.readUInt32LE(4);
	if (declared > bytes.length - 8) {
		const actual = bytes.length - 8;
		return {
			error: `truncated: the container declares ${declared} bytes after its header but has ${actual}`
		};
	}
	const found = new Map<string, Buffer>();
	for (let offset = 12; offset + 8 <= bytes.length; ) {
		const length = bytes.readUInt32LE(offset + 4);
		const name = bytes.toString('latin1', offset, offset + 4);
		if (!found.has(name)) found.set(name, bytes.subarray(offset + 8, offset + 8 + length));
		offset += 8 + length + (length % 2);
	}
	return audioFacts(found.get('fmt '), found.get('data'));
}

function audioFacts(format: Buffer | undefined, samples: Buffer | undefined): MediaFacts {
	if (!format || format.length < 16 || !samples) return { error: 'missing fmt or data chunk' };
	const encoding = format.readUInt16LE(0);
	if (encoding !== 1 && encoding !== 3) return { error: `unsupported WAV encoding ${encoding}` };
	const bytesPerSecond = format.readUInt32LE(4) * format.readUInt16LE(12);
	if (bytesPerSecond === 0) return { error: 'invalid audio format' };
	if (samples.length === 0) return { error: 'contains no audio samples' };
	return {
		kind: 'audio',
		durationSeconds: Math.round((samples.length / bytesPerSecond) * 1e6) / 1e6
	};
}
