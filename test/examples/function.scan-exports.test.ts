import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { scanExports } from '../../src/utils/development-tooling/scanExports';
import { scanSymbolErrors } from '../../src/utils/development-tooling/scanSymbolErrors';

const exportedModule = [
	'export function format(value: string): string { return value.trim(); }',
	'export const square = (n: number): number => n * n;'
].join('\n');

const throwingModule = [
	"export function read(): string { throw new TypeError('missing'); }",
	"export function load(): void { fail('missing'); }",
	"export function fetchUser(): void { error(404, 'gone'); }"
].join('\n');

const indirectModule = 'export function run(callback: () => void): void { callback(); }';

const throwingSymbols = [
	{ name: 'read', errorStatus: 'found', errors: ['TypeError'] },
	{ name: 'load', errorStatus: 'found', errors: ['ExpectedCliError'] },
	{ name: 'fetchUser', errorStatus: 'found', errors: ['HttpError 404'] }
];

const throwingErrors = ['ExpectedCliError', 'HttpError 404', 'TypeError'];

test('Lists top-level exported names from source', () => {
	const scan = scanExports(exportedModule);
	expect(scan.symbols.map((symbol) => symbol.name)).toEqual(['format', 'square']);
	expect(scan.errors).toEqual([]);
	recordExampleCases(
		{
			unitId: 'function.scan-exports',
			symbol: 'scanExports',
			state: 'lists-top-level-exported-names-from-source',
			evidence: 'examples-cases',
			file: 'lists-top-level-exported-names-from-source.json'
		},
		[
			{
				name: 'format and square are exported',
				input: { code: exportedModule },
				output: { names: ['format', 'square'], errors: [] }
			}
		]
	);
});

test('Reports sorted thrown and fail errors per symbol and file', () => {
	const scan = scanExports(throwingModule);
	expect(scan.errors).toEqual(throwingErrors);
	expect(
		scan.symbols.map(({ name, errorStatus, errors }) => ({ name, errorStatus, errors }))
	).toEqual(throwingSymbols);
	recordExampleCases(
		{
			unitId: 'function.scan-exports',
			symbol: 'scanExports',
			state: 'reports-sorted-thrown-and-fail-errors-per-symbol-and-file',
			evidence: 'examples-cases',
			file: 'reports-sorted-thrown-and-fail-errors-per-symbol-and-file.json'
		},
		[
			{
				name: 'throw new, fail and numeric error calls in three functions',
				input: { code: throwingModule },
				output: { symbols: throwingSymbols, errors: throwingErrors }
			}
		]
	);
});

test('Marks indirect calls as unknown and keeps unmatched symbols', () => {
	const symbols = scanSymbolErrors(indirectModule, [
		{ name: 'run', kind: 'function', inputs: [] },
		{ name: 'ghost', kind: 'function', inputs: [] }
	]);
	expect(symbols).toEqual([
		{ name: 'run', kind: 'function', inputs: [], errors: [], errorStatus: 'unknown' },
		{ name: 'ghost', kind: 'function', inputs: [] }
	]);
	recordExampleCases(
		{
			unitId: 'function.scan-exports',
			symbol: 'scanSymbolErrors',
			state: 'marks-indirect-calls-as-unknown-and-keeps-unmatched-symbols',
			evidence: 'examples-cases',
			file: 'marks-indirect-calls-as-unknown-and-keeps-unmatched-symbols.json'
		},
		[
			{
				name: 'callback call is indirect; ghost has no declaration',
				input: { code: indirectModule, symbols: ['run', 'ghost'] },
				output: symbols
			}
		]
	);
});
