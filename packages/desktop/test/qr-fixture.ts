import type { OfferVectors } from './qr-fixture.types';
import { readFileSync } from 'node:fs';
import jsQR from 'jsqr';
import type { QrSymbol } from '../src/utils/qrSymbol';
const file = new URL('../../remote/test/support/offer-vectors.json', import.meta.url);
export const offerVectors = JSON.parse(readFileSync(file, 'utf8')) as OfferVectors;

/** Every run of dark modules in the path of a symbol: where it starts and how long it is. */
export function runs(path: string): { x: number; y: number; length: number }[] {
	return [...path.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)].map((found) => ({
		x: Number(found[1]),
		y: Number(found[2]),
		length: Number(found[3])
	}));
}

/** The symbol as a screen shows it: each module a square of `scale` pixels, dark on light. */
export function pixels(symbol: Pick<QrSymbol, 'size' | 'quiet' | 'path'>, scale = 4) {
	const side = (symbol.size + symbol.quiet * 2) * scale;
	const data = new Uint8ClampedArray(side * side * 4).fill(255);
	const dark = (x: number, y: number) => data.fill(0, (y * side + x) * 4, (y * side + x) * 4 + 3);
	for (const run of runs(symbol.path)) {
		for (let y = run.y * scale; y < (run.y + 1) * scale; y++)
			for (let x = run.x * scale; x < (run.x + run.length) * scale; x++) dark(x, y);
	}
	return { data, side };
}

/** What the independent decoder reads from pixels, or null when it finds no symbol. */
export function decodedPixels(image: { data: Uint8ClampedArray; side: number }): string | null {
	return jsQR(image.data, image.side, image.side)?.data ?? null;
}

export function decoded(symbol: Pick<QrSymbol, 'size' | 'quiet' | 'path'>, scale = 4) {
	return decodedPixels(pixels(symbol, scale));
}
