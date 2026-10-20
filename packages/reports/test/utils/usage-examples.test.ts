import { expect, test } from 'vitest';
import { compact, usageExamples } from '../../src/components/usage-examples/usageExamples';

test('expected result changes preserve falsy, removed and newly added fields', () => {
	const rows = usageExamples([
		{ name: 'First', input: {}, output: { count: 0, flags: [false, null] } },
		{ name: 'Later', input: {}, output: { count: 1, enabled: false } }
	]);
	expect(rows[1].changes).toEqual([
		{ field: 'count', was: 0, now: 1 },
		{ field: 'flags', was: [false, null], now: undefined },
		{ field: 'enabled', was: undefined, now: false }
	]);
	expect(compact({ empty: '', list: [], zero: 0 })).toBe('{ "empty": "", "list": [], "zero": 0 }');
});
