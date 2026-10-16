import { expect, test } from 'vitest';
import { qrLimits, qrSymbol } from '../../src/utils/qrSymbol';
import { decoded, decodedPixels, offerVectors, pixels, runs } from '../qr-fixture';

const offer = offerVectors.valid.text;
const longest = offer + 'a'.repeat(qrLimits.maxBytes - offer.length);

test('the symbol of an offer is read back by an independent decoder as exactly its text', () => {
	const symbol = qrSymbol(offer);
	expect(decoded(symbol)).toBe(offer);
	expect(decoded(symbol, 2)).toBe(offer);
	expect(decoded(symbol, 7)).toBe(offer);
});

test('every offer of the shared vectors that a phone accepts is drawn and read back', () => {
	const accepted = offerVectors.cases.filter((item) => item.result === 'ok');
	expect(accepted.length).toBeGreaterThan(5);
	for (const item of accepted)
		expect([item.name, decoded(qrSymbol(item.text))]).toEqual([item.name, item.text]);
});

test('the longest text an offer may be still fits the bound of the symbol, and reads back', () => {
	expect(longest).toHaveLength(qrLimits.maxBytes);
	const symbol = qrSymbol(longest);
	expect(symbol.size).toBeLessThanOrEqual(qrLimits.maxModules);
	expect(decoded(symbol)).toBe(longest);
});

test('what does not fit, or is not plain text of an offer, is refused and never drawn', () => {
	for (const text of [longest + 'a', '', 'harness-pair:v1;origin=https://relаy.example', 'a\nb'])
		expect(() => qrSymbol(text)).toThrow('This cannot be shown as a QR code.');
});

test('the symbol is square, has its quiet zone, and draws nothing outside its modules', () => {
	const symbol = qrSymbol(offer);
	expect(symbol.quiet).toBe(qrLimits.quiet);
	expect(symbol.quiet).toBeGreaterThanOrEqual(4);
	expect((symbol.size - 17) % 4).toBe(0);
	const drawn = runs(symbol.path);
	expect(drawn.length).toBeGreaterThan(symbol.size);
	const { quiet, size } = symbol;
	for (const run of drawn) {
		expect(run.length).toBeGreaterThan(0);
		expect(Math.min(run.x, run.y)).toBeGreaterThanOrEqual(quiet);
		expect(Math.max(run.x + run.length, run.y + 1)).toBeLessThanOrEqual(quiet + size);
	}
});

test('a symbol with a blemish is still read: its correction level leaves room for one', () => {
	const symbol = qrSymbol(offer);
	const scale = 4;
	const image = pixels(symbol, scale);
	/** A light patch of 7 by 7 modules, away from the patterns a reader steers by. */
	const from = (symbol.quiet + 34) * scale;
	const top = (symbol.quiet + 12) * scale;
	for (let y = top; y < top + 7 * scale; y++)
		image.data.fill(255, (y * image.side + from) * 4, (y * image.side + from + 7 * scale) * 4);
	expect(symbol.size).toBe(57);
	expect(decodedPixels(image)).toBe(offer);
});
