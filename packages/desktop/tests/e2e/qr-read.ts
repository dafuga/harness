import type { Picture } from './qr-read.types';
import { inflateSync } from 'node:zlib';
import type { Locator } from '@playwright/test';
import jsQR from 'jsqr';

/** The header and the packed rows of a PNG as a browser writes one: 8 bits, not interlaced. */
function picture(file: Buffer): Picture {
	const parts: Buffer[] = [];
	let header = Buffer.alloc(13);
	for (let at = 8; at < file.length; ) {
		const length = file.readUInt32BE(at);
		const type = file.toString('latin1', at + 4, at + 8);
		const body = file.subarray(at + 8, at + 8 + length);
		if (type === 'IHDR') header = Buffer.from(body);
		if (type === 'IDAT') parts.push(body);
		at += length + 12;
	}
	const [depth, kind, , , interlace] = header.subarray(8);
	if (depth !== 8 || interlace !== 0 || (kind !== 2 && kind !== 6))
		throw new Error('This reader takes 8-bit RGB or RGBA pictures that are not interlaced.');
	const channels = kind === 6 ? 4 : 3;
	const rows = inflateSync(Buffer.concat(parts));
	return { width: header.readUInt32BE(0), height: header.readUInt32BE(4), channels, rows };
}

function paeth(left: number, up: number, corner: number): number {
	const guess = left + up - corner;
	const [a, b, c] = [Math.abs(guess - left), Math.abs(guess - up), Math.abs(guess - corner)];
	if (a <= b && a <= c) return left;
	return b <= c ? up : corner;
}

/** One byte of a row as it was before the PNG filter of that row was applied. */
function plain(filter: number, near: { left: number; up: number; corner: number }): number {
	if (filter === 1) return near.left;
	if (filter === 2) return near.up;
	if (filter === 3) return (near.left + near.up) >> 1;
	return filter === 4 ? paeth(near.left, near.up, near.corner) : 0;
}

/** Every pixel as red, green, blue and opacity, row by row. */
function pixels({ width, height, channels, rows }: Picture): Uint8ClampedArray {
	const stride = width * channels;
	const raw = new Uint8Array(stride * height);
	for (let y = 0; y < height; y++) {
		const filter = rows[y * (stride + 1)];
		for (let x = 0; x < stride; x++) {
			const at = y * stride + x;
			const left = x >= channels ? raw[at - channels] : 0;
			const up = y > 0 ? raw[at - stride] : 0;
			const corner = x >= channels && y > 0 ? raw[at - stride - channels] : 0;
			raw[at] = rows[y * (stride + 1) + 1 + x] + plain(filter, { left, up, corner });
		}
	}
	const data = new Uint8ClampedArray(width * height * 4).fill(255);
	for (let index = 0; index < width * height; index++)
		data.set(raw.subarray(index * channels, index * channels + channels), index * 4);
	return data;
}

/** The text of the QR code that is shown there, or null when no reader would find one. */
export async function scannedText(target: Locator): Promise<string | null> {
	const shown = picture(await target.screenshot({ animations: 'disabled' }));
	return jsQR(pixels(shown), shown.width, shown.height)?.data ?? null;
}
