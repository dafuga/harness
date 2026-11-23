import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	auditCurlyFunctions,
	auditIndentedPythonBlocks
} from '../../src/audit/development-tooling/adapters/blockHelpers';

const UNIT_ID = 'audit.adapters-block-helpers';

const tightLimits = {
	maxFileLines: 300,
	maxFunctionLines: 40,
	maxClassLines: 150,
	maxMethodLines: 25,
	maxNestingDepth: 3,
	maxParameters: 3,
	maxComplexity: 8,
	maxClassesPerFile: 1
};

const shortFunction = [
	'export function parseRange(text: string): Range {',
	"    const [start, end] = text.split('-');",
	'    return { start: Number(start), end: Number(end) };',
	'}'
];

const unclosedFunction = ['export function open(): void {', '    run();'];

const wideFunction = [
	'export function build(a: number, b: number, c: number, d: number, e: number, f: number): number {',
	'    return a + b + c + d + e + f;',
	'}'
];

const routeFunction = [
	'export function route(a: number, b: number, c: number, d: number, e: number, f: number): number {',
	'    if (a) return 1;',
	'    if (b) return 2;',
	'    if (c) return 3;',
	'    if (d) return 4;',
	'    if (e) return 5;',
	'    if (f) return 6;',
	'    if (a) {',
	'        if (b) {',
	'            if (c) {',
	'                if (d) {',
	'                    if (e) {',
	'                    }',
	'                }',
	'            }',
	'        }',
	'    }',
	'    return 0;',
	'}'
];

const pythonSample = [
	'def sync_units(a, b, c, d, e):',
	'    return a',
	'',
	'def tiny():',
	'    return 1'
];

const asyncSample = ['async def fetch(a, b, c, d, e):', '    return a'];

function longFunction(): string[] {
	const body = Array.from({ length: 56 }, (_, index) => `    const value${index} = ${index};`);
	return ['export function bigFunction(): number {', ...body, '}'];
}

function startsExport(line: string): boolean {
	return line.startsWith('export function ');
}

function meta(symbol: string, state: string) {
	return { unitId: UNIT_ID, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

test('Flags curly functions over the default 55-line limit', () => {
	const short = auditCurlyFunctions('src/parse.ts', shortFunction, startsExport);
	const long = auditCurlyFunctions('src/big.ts', longFunction(), startsExport);
	const empty = auditCurlyFunctions('src/empty.ts', [], startsExport);
	const unclosed = auditCurlyFunctions('src/open.ts', unclosedFunction, startsExport);
	expect(short).toEqual([]);
	expect(long).toEqual([
		{
			path: 'src/big.ts',
			rule: 'small-function',
			message: 'Block starting near line 1 has 58 lines. Limit is 55.'
		}
	]);
	expect(empty).toEqual([]);
	expect(unclosed).toEqual([]);

	recordExampleCases(
		meta('auditCurlyFunctions', 'flags-curly-functions-over-the-default-55-line-limit'),
		[
			{
				name: 'short function stays under the limit',
				input: { path: 'src/parse.ts', lineCount: shortFunction.length },
				output: short
			},
			{
				name: 'function of 58 lines breaks the limit',
				input: { path: 'src/big.ts', lineCount: 58 },
				output: long
			},
			{
				name: 'empty file yields no findings',
				input: { path: 'src/empty.ts', lineCount: 0 },
				output: empty
			},
			{
				name: 'unclosed block is dropped without a finding',
				input: { path: 'src/open.ts', lineCount: unclosedFunction.length },
				output: unclosed
			}
		]
	);
});

test('Reports a deeply nested block that breaks several limits', () => {
	const route = auditCurlyFunctions('src/route.ts', routeFunction, startsExport);
	const wide = auditCurlyFunctions('src/build.ts', wideFunction, startsExport);
	const tight = auditCurlyFunctions('src/build.ts', wideFunction, startsExport, tightLimits);
	expect(route).toEqual([
		{
			path: 'src/route.ts',
			rule: 'max-parameters',
			message: 'Block starting near line 1 has 6 parameters. Limit is 4.'
		},
		{
			path: 'src/route.ts',
			rule: 'max-complexity',
			message: 'Block starting near line 1 has complexity 12. Limit is 10.'
		},
		{
			path: 'src/route.ts',
			rule: 'max-nesting',
			message: 'Block starting near line 1 has 5 nested levels. Limit is 4.'
		}
	]);
	expect(wide).toEqual([
		{
			path: 'src/build.ts',
			rule: 'max-parameters',
			message: 'Block starting near line 1 has 6 parameters. Limit is 4.'
		}
	]);
	expect(tight[0].message).toBe('Block starting near line 1 has 6 parameters. Limit is 3.');

	recordExampleCases(
		meta('auditCurlyFunctions', 'reports-a-deeply-nested-block-that-breaks-several-limits'),
		[
			{
				name: 'route block breaks parameters, complexity and nesting',
				input: { path: 'src/route.ts', lineCount: routeFunction.length },
				output: route
			},
			{
				name: 'six parameters under default limits',
				input: { path: 'src/build.ts', lineCount: wideFunction.length },
				output: wide
			},
			{
				name: 'six parameters under tight limits',
				input: { path: 'src/build.ts', lineCount: wideFunction.length, maxParameters: 3 },
				output: tight
			}
		]
	);
});

test('Scans Python def blocks and skips async def', () => {
	const sync = auditIndentedPythonBlocks('scripts/sync.py', pythonSample);
	const fetch = auditIndentedPythonBlocks('scripts/fetch.py', asyncSample);
	expect(sync).toEqual([
		{
			path: 'scripts/sync.py',
			rule: 'max-parameters',
			message: 'Block starting near line 1 has 5 parameters. Limit is 4.'
		}
	]);
	expect(fetch).toEqual([]);

	recordExampleCases(
		meta('auditIndentedPythonBlocks', 'scans-python-def-blocks-and-skips-async-def'),
		[
			{
				name: 'def with five parameters breaks the limit',
				input: { path: 'scripts/sync.py', lineCount: pythonSample.length },
				output: sync
			},
			{
				name: 'async def is never matched',
				input: { path: 'scripts/fetch.py', lineCount: asyncSample.length },
				output: fetch
			}
		]
	);
});
