import { deflateSync } from 'node:zlib';

/** SYNTHETIC. A real grey PNG of exactly this size, with the chunk checksums a reader verifies. */
export function syntheticPng(width: number, height: number): Buffer {
	const crc = (bytes: Buffer) => {
		let value = ~0;
		for (const byte of bytes) {
			value ^= byte;
			for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
		}
		return ~value >>> 0;
	};
	const chunk = (type: string, data: Buffer) => {
		const [length, sum, body] = [Buffer.alloc(4), Buffer.alloc(4), Buffer.from(type)];
		length.writeUInt32BE(data.length);
		sum.writeUInt32BE(crc(Buffer.concat([body, data])));
		return Buffer.concat([length, body, data, sum]);
	};
	const head = Buffer.alloc(13);
	head.writeUInt32BE(width, 0);
	head.writeUInt32BE(height, 4);
	head.set([8, 0, 0, 0, 0], 8);
	const pixels = deflateSync(Buffer.alloc((width + 1) * height, 128));
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	return Buffer.concat([
		signature,
		chunk('IHDR', head),
		chunk('IDAT', pixels),
		chunk('IEND', Buffer.alloc(0))
	]);
}
