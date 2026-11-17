import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { auditBlocks } from '../../src/audit/development-tooling/blockRules';

const filePath = 'src/orders/pricing.ts';
const shortFunction = ['export function add(a: number, b: number): number {', '\treturn a + b;', '}'];
const fiveParameters = [
	'export function price(a: number, b: number, c: number, d: number, e: number): number {',
	'\treturn a;',
	'}'
];
const fourParameters = [
	'export function price(a: number, b: number, c: number, d: number): number {',
	'\treturn a;',
	'}'
];
const managerClass = [
	'export class CartManager {',
	'\ttotal(items: number[]): number {',
	'\t\treturn items.length;',
	'\t}',
	'}'
];
const strictLimits = {
	maxFileLines: 200,
	maxFunctionLines: 40,
	maxClassLines: 100,
	maxMethodLines: 25,
	maxNestingDepth: 3,
	maxParameters: 3,
	maxComplexity: 8,
	maxClassesPerFile: 1
};

test('Reports no findings for a short valid function', () => {
	const output = auditBlocks(filePath, shortFunction);
	expect(output).toEqual([]);

	recordExampleCases(
		{
			unitId: 'audit.block-rules',
			symbol: 'auditBlocks',
			state: 'reports-no-findings-for-a-short-valid-function',
			evidence: 'examples-cases',
			file: 'reports-no-findings-for-a-short-valid-function.json'
		},
		[{ name: 'short function under default limits', input: { path: filePath, lines: shortFunction }, output }]
	);
});

test('Reports a function with too many parameters', () => {
	const flagged = auditBlocks(filePath, fiveParameters);
	const passing = auditBlocks(filePath, fourParameters);
	const strictFlagged = auditBlocks(filePath, fourParameters, strictLimits);
	expect(flagged).toEqual([
		{
			path: filePath,
			rule: 'max-parameters',
			message: 'Function starting near line 1 has 5 parameters. Limit is 4.'
		}
	]);
	expect(passing).toEqual([]);
	expect(strictFlagged).toEqual([
		{
			path: filePath,
			rule: 'max-parameters',
			message: 'Function starting near line 1 has 4 parameters. Limit is 3.'
		}
	]);

	recordExampleCases(
		{
			unitId: 'audit.block-rules',
			symbol: 'auditBlocks',
			state: 'reports-a-function-with-too-many-parameters',
			evidence: 'examples-cases',
			file: 'reports-a-function-with-too-many-parameters.json'
		},
		[
			{ name: 'five parameters exceed the default limit of 4', input: { path: filePath, lines: fiveParameters }, output: flagged },
			{ name: 'four parameters meet the default limit of 4', input: { path: filePath, lines: fourParameters }, output: passing },
			{
				name: 'four parameters exceed a custom limit of 3',
				input: { path: filePath, lines: fourParameters, limits: strictLimits },
				output: strictFlagged
			}
		]
	);
});

test('Reports a catch-all Manager class name', () => {
	const output = auditBlocks(filePath, managerClass);
	expect(output).toEqual([
		{
			path: filePath,
			rule: 'no-manager-name',
			message: 'Class starting near line 1 uses a catch-all Manager name.'
		}
	]);

	recordExampleCases(
		{
			unitId: 'audit.block-rules',
			symbol: 'auditBlocks',
			state: 'reports-a-catch-all-manager-class-name',
			evidence: 'examples-cases',
			file: 'reports-a-catch-all-manager-class-name.json'
		},
		[{ name: 'class CartManager under default limits', input: { path: filePath, lines: managerClass }, output }]
	);
});
