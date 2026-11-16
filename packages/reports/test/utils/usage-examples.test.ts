import { expect, test } from 'vitest';
import {
	compact,
	usageExamples
} from '../../src/components/shared-primitives/usage-examples/usageExamples';
import type { CompactValue } from '../../src/components/shared-primitives/usage-examples/usageExamples.types';

test('snippets retain setup and distinguish falsy outputs from expected errors', () => {
	const snippets = usageExamples(
		[
			{ name: 'False', call: 'choose(value)', input: 0, output: false },
			{ name: 'Zero', call: 'choose(0)', input: 0, output: 0 },
			{ name: 'Null', call: 'choose(null)', input: null, output: null },
			{ name: 'Failure', call: 'fail()', input: [], error: null }
		],
		'const value = 0;'
	);
	expect(snippets).toEqual([
		'const value = 0;\nchoose(value)\n// => false',
		'const value = 0;\nchoose(0)\n// => 0',
		'const value = 0;\nchoose(null)\n// => null',
		'const value = 0;\nfail()\n// throws null'
	]);
	expect(compact({ empty: '', list: [], zero: 0 })).toBe('{ "empty": "", "list": [], "zero": 0 }');
});

test('a missing authored call is a comment, never fabricated executable code', () => {
	expect(usageExamples([{ name: 'Legacy', input: false, output: '' }])).toEqual([
		'// Call not documented\n// Input: false\n// => ""'
	]);
});

test('formatters propagate unsupported and caller-provided value errors', () => {
	const cycle: Record<string, unknown> = {};
	cycle.self = cycle;
	const error = new Error('value unavailable');
	const inaccessible = {
		get value(): never {
			throw error;
		}
	};
	for (const format of [
		(value: CompactValue) => compact(value),
		(value: unknown) => usageExamples([{ name: 'Result', input: null, output: value }])
	]) {
		expect(() => format(1n)).toThrow(TypeError);
		expect(() => format(cycle)).toThrow(RangeError);
		expect(() => format(inaccessible)).toThrow(error);
	}
});
