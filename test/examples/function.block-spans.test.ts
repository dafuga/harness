import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { blockSpans } from '../../src/utils/development-tooling/block-spans/blockSpans';
import type { BlockSpan } from '../../src/utils/development-tooling/block-spans/blockSpans.types';

test('Finds top-level functions and named class methods', () => {
	const inputs = [
		'export function parseTitle(input) {\n  return input.trim();\n}\n',
		'class Report {\n  render(options) {\n    return options.title;\n  }\n}\n',
		'const limit = 10;\n'
	];
	const outputs = inputs.map((input) => blockSpans(input));
	expect(outputs.map((spans) => spans.map(({ name, kind }) => ({ name, kind })))).toEqual([
		[{ name: 'parseTitle', kind: 'function' }],
		[{ name: 'Report.render', kind: 'method' }],
		[]
	]);
	const cases: Array<{ name: string; input: string; output: BlockSpan[] }> = [
		{ name: 'named top-level function', input: inputs[0], output: outputs[0] },
		{ name: 'named class method', input: inputs[1], output: outputs[1] },
		{ name: 'ordinary constant has no span', input: inputs[2], output: outputs[2] }
	];
	recordExampleCases(
		{
			unitId: 'function.block-spans',
			symbol: 'blockSpans',
			state: 'finds-top-level-functions-and-named-class-methods',
			evidence: 'examples-cases',
			file: 'finds-top-level-functions-and-named-class-methods.json'
		},
		cases
	);
});
