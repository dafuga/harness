import { expect, test } from 'vitest';
import { compact, usageExamples } from '../../src/components/usage-examples/usageExamples';

test('snippets retain setup and distinguish falsy outputs from expected errors', () => {
	const snippets = usageExamples(
		[
			{ name: 'False', call: 'choose(value)', input: 0, output: false },
			{ name: 'Zero', call: 'choose(0)', input: 0, output: 0 },
			{ name: 'Null', call: 'choose(null)', input: null, output: null },
			{ name: 'Failure', call: 'fail()', input: [], error: null },
			{ name: 'Void', call: 'finish()', input: [], returns: 'void' }
		],
		'const value = 0;'
	);
	expect(snippets).toEqual([
		'const value = 0;\nchoose(value)\n// => false',
		'const value = 0;\nchoose(0)\n// => 0',
		'const value = 0;\nchoose(null)\n// => null',
		'const value = 0;\nfail()\n// throws null',
		'const value = 0;\nfinish()\n// => undefined'
	]);
	expect(compact({ empty: '', list: [], zero: 0 })).toBe('{ "empty": "", "list": [], "zero": 0 }');
});

test('a missing authored call is a comment, never fabricated executable code', () => {
	expect(usageExamples([{ name: 'Legacy', input: false, output: '' }])).toEqual([
		'// Call not documented\n// Input: false\n// => ""'
	]);
});
