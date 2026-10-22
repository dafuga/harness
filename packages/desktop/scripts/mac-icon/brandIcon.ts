import type { BrandIconVariant } from '../../src/utils/development-tooling/brandIcon';
import { deflateSync } from 'node:zlib';
import { brandColors, brandGrid, brandTiles } from '../../../reports/src/utils/brandMark';

interface Canvas {
	size: number;
	mac: boolean;
	boxes: number[][];
	inset: number;
	radius: number;
}

const [gold, navy] = [brandColors.gold, brandColors.navy].map((hex) =>
	[1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))
);

const table = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

function crc(bytes: Buffer): number {
	let c = 0xffffffff;
	for (const byte of bytes) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(kind: string, data: Buffer): Buffer {
	const head = Buffer.alloc(8);
	head.writeUInt32BE(data.length, 0);
	head.write(kind, 4, 'ascii');
	const tail = Buffer.alloc(4);
	tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), data])), 0);
	return Buffer.concat([head, data, tail]);
}

/** The pixel boxes of the five tiles, every edge on a whole pixel so the picture stays crisp. */
function boxes(size: number, mac: boolean): number[][] {
	const mark = Math.round(size * (mac ? 0.5 : 0.625));
	const offset = Math.floor((size - mark) / 2);
	const at = (unit: number) => offset + Math.round((unit * mark) / brandGrid);
	return brandTiles.map((t) => [at(t.x), at(t.y), at(t.x + t.size), at(t.y + t.size)]);
}

/** How much of a pixel the rounded plate covers, from 16 samples; all of it for iOS. */
function coverage(canvas: Canvas, x: number, y: number): number {
	if (!canvas.mac) return 1;
	const { size, inset, radius } = canvas;
	const [low, high] = [inset + radius, size - inset - radius];
	let inside = 0;
	for (let sample = 0; sample < 16; sample++) {
		const px = x + ((sample % 4) + 0.5) / 4;
		const py = y + (Math.floor(sample / 4) + 0.5) / 4;
		const dx = px - Math.min(Math.max(px, low), high);
		const dy = py - Math.min(Math.max(py, low), high);
		if (dx * dx + dy * dy <= radius * radius) inside++;
	}
	return inside / 16;
}

function pixel(canvas: Canvas, x: number, y: number): number[] {
	const tile = canvas.boxes.some(([l, t, r, b]) => x >= l && x < r && y >= t && y < b);
	const colour = tile ? gold : navy;
	return canvas.mac ? [...colour, Math.round(255 * coverage(canvas, x, y))] : colour;
}

/** A PNG of the modular H rasterised from the shared geometry: gold tiles on navy. */
export function brandIcon(size: number, variant: BrandIconVariant = 'ios'): Uint8Array {
	const mac = variant === 'mac';
	const inset = mac ? Math.round(size * 0.1) : 0;
	const radius = (size - 2 * inset) * 0.225;
	const canvas: Canvas = { size, mac, boxes: boxes(size, mac), inset, radius };
	const channels = mac ? 4 : 3;
	const line = size * channels + 1;
	const rows = Buffer.alloc(size * line);
	for (let y = 0; y < size; y++)
		for (let x = 0; x < size; x++) rows.set(pixel(canvas, x, y), y * line + 1 + x * channels);
	const header = Buffer.alloc(13);
	header.writeUInt32BE(size, 0);
	header.writeUInt32BE(size, 4);
	header.set([8, mac ? 6 : 2, 0, 0, 0], 8);
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	const data = chunk('IDAT', deflateSync(rows, { level: 9 }));
	const end = chunk('IEND', Buffer.alloc(0));
	return new Uint8Array(Buffer.concat([signature, chunk('IHDR', header), data, end]));
}
