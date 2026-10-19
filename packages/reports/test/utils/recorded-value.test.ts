import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordCapture } from '../../../../src/utils/record-capture/recordCapture';
import { recordedValue } from '../../src/components/recorded-value/recordedValue';

test('a bounded preview leaves its input intact and makes shortening explicit', () => {
	const value = { long: 'x'.repeat(1000), rows: Array.from({ length: 500 }, (_, id) => ({ id })) };
	const original = JSON.stringify(value);
	const preview = JSON.stringify(recordedValue(value));
	expect(preview.length).toBeLessThan(5000);
	expect(preview).toContain('shortened');
	expect(preview).toContain('488');
	expect(JSON.stringify(value)).toBe(original);
});

test('deep branching values have a bounded presentation and an explicit gap', () => {
	let value: unknown = 1;
	for (let depth = 0; depth < 8; depth++) value = Array(12).fill(value);
	const preview = JSON.stringify(recordedValue(value));
	expect(preview.length).toBeLessThan(20000);
	expect(preview).toContain('Full recorded values');
});

test('missing table fields do not inherit values, or become null', () => {
	const view = recordedValue([{ toString: 'literal' }, { other: null }]);
	expect(view).toMatchObject({
		kind: 'table',
		rows: [
			[
				{ kind: 'scalar', text: 'literal' },
				{ kind: 'notice', text: 'Not recorded' }
			],
			[
				{ kind: 'notice', text: 'Not recorded' },
				{ kind: 'scalar', type: 'Null', text: 'null' }
			]
		]
	});
});

test('records actual typed presentations, checked against independent examples', () => {
	const examples = [
		{
			name: 'an off switch',
			input: false,
			expected: { kind: 'scalar', type: 'Boolean', text: 'false' }
		},
		{ name: 'a zero total', input: 0, expected: { kind: 'scalar', type: 'Number', text: '0' } },
		{
			name: 'no returned value',
			input: null,
			expected: { kind: 'scalar', type: 'Null', text: 'null' }
		},
		{
			name: 'words that look like a flag',
			input: 'false',
			expected: { kind: 'scalar', type: 'Text', text: 'false' }
		},
		{ name: 'no matching items', input: [], expected: { kind: 'notice', text: 'Empty list' } }
	];
	const calls = examples.map(({ name, input }) => ({ name, input, output: recordedValue(input) }));
	examples.forEach((example, index) => expect(calls[index].output).toEqual(example.expected));
	const sha256 = createHash('sha256')
		.update(readFileSync(new URL('../../src/utils/recordedValue.ts', import.meta.url)))
		.digest('hex');
	recordCapture(
		{
			evidence: 'recorded-value-calls',
			kind: 'assertions',
			state: 'formatted-values',
			file: 'readable-recorded-value-calls.json',
			mediaType: 'application/json'
		},
		JSON.stringify({
			schemaVersion: 1,
			kind: 'function-invocations',
			unitId: 'reports.function.recorded-value',
			symbol: 'recordedValue',
			source: { path: 'packages/reports/src/utils/recordedValue.ts', sha256 },
			cases: calls
		})
	);
});
