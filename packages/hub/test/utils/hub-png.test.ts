import { expect, test } from 'vitest';
import { crc32, deflateSync } from 'node:zlib';
import { hubPng } from '../../src/services/hub-projection-service/hubPng';
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function chunk(type: string, data: Uint8Array = Buffer.alloc(0)): Buffer {
	const result = Buffer.alloc(data.length + 12);
	result.writeUInt32BE(data.length);
	result.write(type, 4);
	result.set(data, 8);
	result.writeUInt32BE(crc32(result.subarray(4, -4)), result.length - 4);
	return result;
}
function header(
	options: {
		width?: number;
		height?: number;
		depth?: number;
		color?: number;
		interlace?: number;
	} = {}
) {
	const bytes = Buffer.alloc(13);
	bytes.writeUInt32BE(options.width ?? 1);
	bytes.writeUInt32BE(options.height ?? 1, 4);
	bytes[8] = options.depth ?? 8;
	bytes[9] = options.color ?? 6;
	bytes[12] = options.interlace ?? 0;
	return chunk('IHDR', bytes);
}
function png(parts: Buffer[]): Uint8Array {
	return Buffer.concat([signature, ...parts]);
}
const rgba = deflateSync(Buffer.from([0, 255, 0, 0, 255]));
const idat = chunk('IDAT', rgba),
	iend = chunk('IEND');
test('portable PNG validator accepts RGBA, indexed palette and Adam7 scanlines', async () => {
	for (const parts of [
		[header(), idat, iend],
		[header({ interlace: 1 }), idat, iend],
		[
			header({ color: 3, depth: 1 }),
			chunk('PLTE', Buffer.from([255, 0, 0])),
			chunk('IDAT', deflateSync(Buffer.from([0, 0]))),
			iend
		]
	])
		expect(await hubPng(png(parts))).toEqual({ width: 1, height: 1 });
});
test('PNG rejects malformed chunks, CRC, ordering, palette and headers before rendering', async () => {
	const corrupt = Buffer.from(idat);
	corrupt[corrupt.length - 1] ^= 1;
	for (const parts of [
		[header(), idat],
		[header(), iend],
		[idat, header(), iend],
		[header(), corrupt, iend],
		[header(), idat, iend, Buffer.from([0])],
		[header(), idat, chunk('tEXt'), idat, iend],
		[header(), header(), idat, iend],
		[header(), chunk('FAKE'), idat, iend],
		[header({ color: 3 }), idat, iend],
		[header({ color: 3, depth: 1 }), chunk('PLTE', Buffer.alloc(9)), idat, iend],
		[header({ color: 0 }), chunk('PLTE', Buffer.alloc(3)), idat, iend],
		[header({ depth: 3 }), idat, iend],
		[header({ color: 1 }), idat, iend],
		[header({ width: 0 }), idat, iend],
		[header({ interlace: 2 }), idat, iend],
		[header({ width: 32000000 }), idat, iend]
	])
		await expect(hubPng(png(parts))).rejects.toMatchObject({ code: 'artifact-corrupt' });
});
test('PNG rejects truncated deflate, invalid filters, incomplete rows and decompression expansion', async () => {
	const checksum = Buffer.from(rgba);
	checksum[checksum.length - 1] ^= 1;
	for (const compressed of [
		rgba.subarray(0, -1),
		checksum,
		Buffer.concat([rgba, Buffer.from([1])]),
		deflateSync(Buffer.from([0, 255])),
		deflateSync(Buffer.from([5, 255, 0, 0, 255])),
		deflateSync(Buffer.alloc(4_000_000))
	])
		await expect(hubPng(png([header(), chunk('IDAT', compressed), iend]))).rejects.toMatchObject({
			code: 'artifact-corrupt'
		});
});
