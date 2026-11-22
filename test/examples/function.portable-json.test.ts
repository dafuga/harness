import { test } from 'vitest';
import { maxJsonDepth, portableJson } from '../../src/utils/development-tooling/portableJson';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

function nestedArrays(depth: number): unknown {
	let value: unknown = 0;
	for (let level = 0; level < depth; level += 1) value = [value];
	return value;
}

test('Accepts supported portable JSON values', () => {
	const examples = [
		{
			name: 'build request object',
			input: { name: 'build', retries: 3, tags: ['ci', 'fast'] }
		},
		{ name: 'mixed JSON array', input: [1, 2.5, 'text', null, true] },
		{ name: 'status string', input: 'build finished' }
	];
	const cases = examples.map(({ name, input }) => ({
		name,
		input,
		output: portableJson(input)
	}));

	for (const example of cases) expect(example.output).toBe(true);
	recordExampleCases(
		{
			unitId: 'function.portable-json',
			symbol: 'portableJson',
			state: 'accepts-supported-portable-json-values',
			evidence: 'examples-cases',
			file: 'accepts-supported-portable-json-values.json'
		},
		cases
	);
});

test('Enforces the JSON nesting limit', () => {
	const withinLimit = nestedArrays(maxJsonDepth);
	const beyondLimit = nestedArrays(maxJsonDepth + 1);
	const cases = [
		{
			name: '64 nested arrays pass from level 0',
			input: { value: withinLimit, level: 0 },
			output: portableJson(withinLimit, 0)
		},
		{
			name: '65 nested arrays fail from level 0',
			input: { value: beyondLimit, level: 0 },
			output: portableJson(beyondLimit, 0)
		},
		{
			name: '65 nested arrays pass from level -1',
			input: { value: beyondLimit, level: -1 },
			output: portableJson(beyondLimit, -1)
		}
	];

	expect(maxJsonDepth).toBe(64);
	expect(cases.map(({ output }) => output)).toEqual([true, false, true]);
	recordExampleCases(
		{
			unitId: 'function.portable-json',
			symbol: 'portableJson',
			state: 'enforces-the-json-nesting-limit',
			evidence: 'examples-cases',
			file: 'enforces-the-json-nesting-limit.json'
		},
		cases
	);
});
