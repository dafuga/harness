import { deflateSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { mediaFacts, pngChecksum } from '../../src/utils/mediaFacts';

function chunk(type: string, data: Buffer): Buffer {
	const body = Buffer.concat([Buffer.from(type), data]);
	const out = Buffer.alloc(12 + data.length);
	out.writeUInt32BE(data.length, 0);
	body.copy(out, 4);
	out.writeUInt32BE(pngChecksum(body), 8 + data.length);
	return out;
}
function png(width: number, height: number): Buffer {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8;
	const pixels = deflateSync(Buffer.alloc(height * (1 + width)));
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	return Buffer.concat([
		signature,
		chunk('IHDR', header),
		chunk('IDAT', pixels),
		chunk('IEND', Buffer.alloc(0))
	]);
}
function wav(samples: number, rate = 8000): Buffer {
	const header = Buffer.alloc(44);
	header.write('RIFF', 0);
	header.writeUInt32LE(36 + samples * 2, 4);
	header.write('WAVEfmt ', 8);
	header.writeUInt32LE(16, 16);
	header.writeUInt16LE(1, 20);
	header.writeUInt16LE(1, 22);
	header.writeUInt32LE(rate, 24);
	header.writeUInt32LE(rate * 2, 28);
	header.writeUInt16LE(2, 32);
	header.writeUInt16LE(16, 34);
	header.write('data', 36);
	header.writeUInt32LE(samples * 2, 40);
	return Buffer.concat([header, Buffer.alloc(samples * 2)]);
}

test('a decodable PNG reports its real dimensions', () => {
	expect(mediaFacts(png(390, 844), 'image/png')).toEqual({
		kind: 'image',
		width: 390,
		height: 844
	});
	expect(pngChecksum(Buffer.from('IEND'))).toBe(0xae426082);
});

test('broken images are refused with the reason', () => {
	const valid = png(20, 10);
	const flipped = Buffer.from(valid);
	flipped[flipped.length - 20] ^= 0xff;
	const short = Buffer.concat([
		valid.subarray(0, 33),
		chunk('IDAT', deflateSync(Buffer.alloc(5))),
		chunk('IEND', Buffer.alloc(0))
	]);
	const error = (bytes: Buffer) => mediaFacts(bytes, 'image/png');
	expect(error(Buffer.from('not an image'))).toEqual({ error: 'missing PNG signature' });
	expect(error(valid.subarray(0, valid.length - 14))).toEqual({
		error: 'truncated before the IEND chunk'
	});
	expect(error(flipped)).toEqual({ error: 'chunk IDAT fails its checksum' });
	expect(error(short)).toEqual({ error: 'pixel data does not match 20x10' });
	expect(mediaFacts(valid, 'image/jpeg')).toEqual({ error: 'unsupported media type image/jpeg' });
});

test('playable WAV audio reports its real duration, and broken audio is refused', () => {
	expect(mediaFacts(wav(2000), 'audio/wav')).toEqual({ kind: 'audio', durationSeconds: 0.25 });
	const error = (bytes: Buffer) => mediaFacts(bytes, 'audio/wav');
	expect(error(Buffer.from('RIFF fixture audio'))).toEqual({ error: 'missing RIFF/WAVE header' });
	expect(error(wav(2000).subarray(0, 200))).toEqual({
		error: 'truncated: the container declares 4036 bytes after its header but has 192'
	});
	expect(error(wav(0))).toEqual({ error: 'contains no audio samples' });
	const unsupported = wav(100);
	unsupported.writeUInt16LE(85, 20);
	expect(error(unsupported)).toEqual({ error: 'unsupported WAV encoding 85' });
});
