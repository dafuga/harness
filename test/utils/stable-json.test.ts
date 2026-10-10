import { format } from 'prettier';
import { expect, test } from 'vitest';
import { stableJson } from '../../src/utils/stableJson';

const options = { parser: 'json', useTabs: true, printWidth: 100 } as const;

test('stableJson matches the project prettier style', async () => {
	const long = Array.from({ length: 6 }, (_, index) => `src/services/Example${index}Service.ts`);
	const values = [
		{ a: [], b: {}, c: ['x', 'y'], d: [{ k: 1, v: ['a'] }], e: long, f: { g: { h: 'i' } } },
		{ text: 'quotes " and \\ slashes / plus\nnewlines', flag: true, none: null, count: 12.5 },
		...[90, 91, 92, 93, 94, 95, 96].map((size) => ({ key: ['a'.repeat(size - 10), 'b'] })),
		{ nested: { deep: { list: ['a'.repeat(40), 'b'.repeat(40)] } }, last: ['z'] }
	];
	for (const value of values) {
		expect(stableJson(value)).toBe(await format(JSON.stringify(value, null, '\t'), options));
	}
});

test('stableJson is deterministic and ends with a newline', () => {
	expect(stableJson({ b: 1, a: [true, null] })).toBe('{\n\t"b": 1,\n\t"a": [true, null]\n}\n');
	expect(stableJson([])).toBe('[]\n');
});
