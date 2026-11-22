import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { qrSymbol } from '../../src/components/networking-security/remote-offer-code/qrSymbol';
import { qrLimits } from '../../src/utils/networking-security/qrSymbol';
import { decoded, runs } from '../qr-fixture';

const REFUSED = 'This cannot be shown as a QR code.';
const OFFER = 'OFFER-42';
const LONGEST = OFFER + 'a'.repeat(qrLimits.maxBytes - OFFER.length);

/** The error as plain JSON: an Error object serializes to nothing on its own. */
function failure(run: () => unknown) {
	try {
		run();
		return null;
	} catch (error) {
		const { name, message } = error as Error;
		return { name, message, isError: error instanceof Error };
	}
}

test('Encodes printable text as a symbol with a four-module quiet margin', () => {
	const symbol = qrSymbol(OFFER);
	const drawn = runs(symbol.path);
	const inside = drawn.every(
		(run) =>
			run.length > 0 &&
			Math.min(run.x, run.y) >= symbol.quiet &&
			run.x + run.length <= symbol.quiet + symbol.size &&
			run.y + 1 <= symbol.quiet + symbol.size
	);

	expect(symbol.size).toBe(21);
	expect(symbol.quiet).toBe(qrLimits.quiet);
	expect(symbol.path.startsWith('M4 4h7v1h-7z')).toBe(true);
	expect(drawn.length).toBeGreaterThan(symbol.size);
	expect(inside).toBe(true);
	expect(decoded(symbol)).toBe(OFFER);

	recordExampleCases(
		{
			unitId: 'desktop.function.qr-symbol',
			symbol: 'qrSymbol',
			state: 'encodes-printable-text-as-a-symbol-with-a-four-module-quiet-margin',
			evidence: 'examples-cases',
			file: 'encodes-printable-text-as-a-symbol-with-a-four-module-quiet-margin.json'
		},
		[
			{
				name: 'encode a short offer',
				input: { text: OFFER },
				output: {
					size: symbol.size,
					quiet: symbol.quiet,
					runCount: drawn.length,
					insideMargin: inside,
					path: symbol.path,
					readBack: decoded(symbol)
				}
			}
		]
	);
});

test('Reads back the longest allowed text within the 77-module bound', () => {
	const symbol = qrSymbol(LONGEST);

	expect(LONGEST).toHaveLength(qrLimits.maxBytes);
	expect(symbol.size).toBe(69);
	expect(symbol.size).toBeLessThanOrEqual(qrLimits.maxModules);
	expect(decoded(symbol)).toBe(LONGEST);

	recordExampleCases(
		{
			unitId: 'desktop.function.qr-symbol',
			symbol: 'qrSymbol',
			state: 'reads-back-the-longest-allowed-text-within-the-77-module-bound',
			evidence: 'examples-cases',
			file: 'reads-back-the-longest-allowed-text-within-the-77-module-bound.json'
		},
		[
			{
				name: 'encode the longest allowed text',
				input: { textLength: LONGEST.length },
				output: {
					size: symbol.size,
					maxModules: qrLimits.maxModules,
					readBack: decoded(symbol)
				}
			}
		]
	);
});

test('Refuses text outside the printable ASCII or length bounds', () => {
	const cases = [
		{ name: 'empty text', text: '' },
		{ name: 'space in text', text: 'a b' },
		{ name: 'newline in text', text: 'a\nb' },
		{ name: 'non-ASCII letter', text: 'relaý.example' },
		{ name: 'one character over the byte limit', text: LONGEST + 'a' }
	];
	const observed = cases.map(({ name, text }) => ({
		name,
		text,
		failure: failure(() => qrSymbol(text))
	}));

	for (const { failure: seen } of observed) {
		expect(seen).not.toBeNull();
		expect(seen?.message).toBe(REFUSED);
		expect(seen?.isError).toBe(true);
	}
	expect(observed.map(({ failure: seen }) => seen?.name)).toEqual(
		observed.map(() => 'QrRefusedError')
	);

	recordExampleCases(
		{
			unitId: 'desktop.function.qr-symbol',
			symbol: 'qrSymbol',
			state: 'refuses-text-outside-the-printable-ascii-or-length-bounds',
			evidence: 'examples-cases',
			file: 'refuses-text-outside-the-printable-ascii-or-length-bounds.json'
		},
		observed.map(({ name, text, failure: seen }) => ({
			name,
			input: { textLength: text.length },
			error: seen
		}))
	);
});

test('Publishes the shared QR limits', () => {
	expect(qrLimits).toEqual({ maxBytes: 320, quiet: 4, maxModules: 77, level: 'M' });

	recordExampleCases(
		{
			unitId: 'desktop.function.qr-symbol',
			symbol: 'qrLimits',
			state: 'publishes-the-shared-qr-limits',
			evidence: 'examples-cases',
			file: 'publishes-the-shared-qr-limits.json'
		},
		[
			{
				name: 'read the shared limits',
				input: {},
				output: { ...qrLimits }
			}
		]
	);
});
