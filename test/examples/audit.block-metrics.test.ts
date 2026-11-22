import { test } from 'vitest';
import {
	capitalize,
	complexityPoints,
	count,
	maxDepth,
	parameterCount
} from '../../src/audit/development-tooling/blockMetrics';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Counts comma-separated parameters from a source line', () => {
	const lines = [
		'function combine(left, right) {',
		'run()',
		'const rows = values.map(({ name, kind, id }, index) => ({',
		'function seed(row: Record<string, unknown> = { id: 1, kind: "note" }, ...rest: string[]) {',
		'output(a: string, b: string, c: string, d: string, e = "one,two") {'
	];
	const outputs = lines.map(parameterCount);

	expect(outputs).toEqual([2, 0, 2, 2, 5]);
	recordExampleCases(
		{
			unitId: 'audit.block-metrics',
			symbol: 'parameterCount',
			state: 'counts-comma-separated-parameters-from-a-source-line',
			evidence: 'examples-cases',
			file: 'counts-comma-separated-parameters-from-a-source-line.json'
		},
		lines.map((input, index) => ({ name: input, input, output: outputs[index] }))
	);
});

test('Counts branch-like tokens with the documented exclusions', () => {
	const lines = [
		'if (ready) return value;',
		'return /foo/.test(line) ? yes : no',
		'switch (kind) {'
	];
	const outputs = lines.map(complexityPoints);

	expect(outputs).toEqual([1, 0, 0]);
	recordExampleCases(
		{
			unitId: 'audit.block-metrics',
			symbol: 'complexityPoints',
			state: 'counts-branch-like-tokens-with-the-documented-exclusions',
			evidence: 'examples-cases',
			file: 'counts-branch-like-tokens-with-the-documented-exclusions.json'
		},
		lines.map((input, index) => ({
			name: ['counts if', 'ignores a regex-return line', 'does not count switch'][index],
			input,
			output: outputs[index]
		}))
	);
});

test('Measures maximum control-block depth from ordered lines', () => {
	const cases = [
		{ name: 'no source lines', lines: [] },
		{
			name: 'nested if and while blocks',
			lines: ['if (ready) {', 'while (running) {', '}', '}']
		}
	];
	const outputs = cases.map(({ lines }) => maxDepth(lines));

	expect(outputs).toEqual([0, 2]);
	recordExampleCases(
		{
			unitId: 'audit.block-metrics',
			symbol: 'maxDepth',
			state: 'measures-maximum-control-block-depth-from-ordered-lines',
			evidence: 'examples-cases',
			file: 'measures-maximum-control-block-depth-from-ordered-lines.json'
		},
		cases.map(({ name, lines }, index) => ({ name, input: lines, output: outputs[index] }))
	);
});

test('Counts non-overlapping separators using split semantics', () => {
	const cases = [
		{ name: 'comma separators in a list', value: 'red,green,red', token: ',' },
		{ name: 'repeated two-character separators', value: 'aaaa', token: 'aa' },
		{ name: 'empty token uses split empty-string behavior', value: 'aaaa', token: '' }
	];
	const outputs = cases.map(({ value, token }) => count(value, token));

	expect(outputs).toEqual([2, 2, 3]);
	recordExampleCases(
		{
			unitId: 'audit.block-metrics',
			symbol: 'count',
			state: 'counts-non-overlapping-separators-using-split-semantics',
			evidence: 'examples-cases',
			file: 'counts-non-overlapping-separators-using-split-semantics.json'
		},
		cases.map(({ name, value, token }, index) => ({
			name,
			input: { value, token },
			output: outputs[index]
		}))
	);
});

test('Capitalizes the first code unit and preserves the rest', () => {
	const values = ['blockMetrics', ''];
	const outputs = values.map(capitalize);

	expect(outputs).toEqual(['BlockMetrics', '']);
	recordExampleCases(
		{
			unitId: 'audit.block-metrics',
			symbol: 'capitalize',
			state: 'capitalizes-the-first-code-unit-and-preserves-the-rest',
			evidence: 'examples-cases',
			file: 'capitalizes-the-first-code-unit-and-preserves-the-rest.json'
		},
		[
			{ name: 'capitalizes the helper name', input: values[0], output: outputs[0] },
			{ name: 'keeps empty input empty', input: values[1], output: outputs[1] }
		]
	);
});
