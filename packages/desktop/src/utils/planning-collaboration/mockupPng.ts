// @harness-uid u_ntxv5f2g76
import { crc32 } from 'node:zlib';

/** Preserve pixels and give each comparison slot its own PNG artifact identity. */
export function mockupPng(bytes: Uint8Array, slot: string): Buffer {
	const png = Buffer.from(bytes);
	const end = png.length - 12;
	const chunk = Buffer.from('tEXtHarness comparison\0' + slot, 'ascii');
	const length = Buffer.alloc(4);
	length.writeUInt32BE(chunk.length - 4);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(chunk));
	return Buffer.concat([png.subarray(0, end), length, chunk, crc, png.subarray(end)]);
}
