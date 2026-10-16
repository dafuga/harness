import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { recordCapture } from '../../../../src/utils/recordCapture';
import { compactRecordedValue } from '../../src/utils/compactRecordedValue';

it.each([false, 0, null, '', 'false', [], {}])('preserves the recorded type of %j', (value) => {
	expect(compactRecordedValue(value)).toBe(JSON.stringify(value));
});
it('keeps graph arrays and short records on one readable line', () => {
	const graph = {
		base: {
			nodes: ['a', 'b', 'c', 't'],
			edges: [
				[1, 0],
				[2, 1],
				[3, 2]
			]
		},
		head: {
			nodes: ['a', 'b', 'c', 't'],
			edges: [
				[1, 0],
				[2, 1],
				[3, 2]
			]
		},
		changed: ['a'],
		uncertain: [],
		sinks: ['t']
	};
	const text = compactRecordedValue(graph);
	expect(JSON.parse(text)).toEqual(graph);
	expect(text.split('\n').length).toBeLessThan(18);
	expect(text).toContain('["a","b","c","t"]');
});
it('preserves escaped strings and does not shorten values', () => {
	const value = { title: 'quotes " \n and , brackets [] {}', long: 'x'.repeat(5000) };
	expect(JSON.parse(compactRecordedValue(value))).toEqual(value);
});
it('uses JSON admission once, including getters, toJSON and ignored array iterators', () => {
	let reads = 0;
	const array = [1, 2];
	array[Symbol.iterator] = function* () {
		yield 99;
		return undefined;
	};
	const value = {
		get answer() {
			reads++;
			return { toJSON: () => 42 };
		},
		array
	};
	expect(JSON.parse(compactRecordedValue(value))).toEqual({ answer: 42, array: [1, 2] });
	expect(reads).toBe(1);
});
it('distinguishes unrecorded and unsupported JSON from null', () => {
	expect(compactRecordedValue(undefined)).toBe('Not recorded');
	expect(compactRecordedValue(Number.NaN)).toBe('null');
	expect(() => compactRecordedValue(1n)).toThrow(TypeError);
});
it('bounds formatting recursion without losing deeply nested recorded JSON', () => {
	let value: unknown = 'leaf';
	for (let level = 0; level < 2000; level++) value = { nested: value };
	expect(JSON.stringify(JSON.parse(compactRecordedValue(value)))).toBe(JSON.stringify(value));
});
it('records checked calls with their actual inputs and returned text', () => {
	const examples = [
		{ name: 'boolean false', input: false, expected: 'false' },
		{ name: 'zero', input: 0, expected: '0' },
		{ name: 'null', input: null, expected: 'null' },
		{ name: 'string', input: 'hello', expected: '"hello"' },
		{
			name: 'short object and array',
			input: { items: ['a', 'b'], ready: true },
			expected: '{"items": ["a","b"],"ready": true}'
		}
	];
	const calls = examples.map(({ name, input }) => ({
		name,
		input,
		output: compactRecordedValue(input)
	}));
	examples.forEach((item, index) => expect(calls[index].output).toBe(item.expected));
	const source = new URL('../../src/utils/compactRecordedValue.ts', import.meta.url);
	const sha256 = createHash('sha256').update(readFileSync(source)).digest('hex');
	recordCapture(
		{
			evidence: 'recorded-value-calls',
			kind: 'assertions',
			state: 'formatted-values',
			file: 'compact-recorded-value-calls.json',
			mediaType: 'application/json'
		},
		JSON.stringify({
			schemaVersion: 1,
			kind: 'function-invocations',
			unitId: 'reports.function.compact-recorded-value',
			symbol: 'compactRecordedValue',
			source: { path: 'packages/reports/src/utils/compactRecordedValue.ts', sha256 },
			cases: calls
		})
	);
});
