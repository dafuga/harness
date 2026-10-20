import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import UsageExamples from '../../src/components/usage-examples/UsageExamples.svelte';
import type { UsageExample } from '../../../../src/utils/unit-documentation/unitDocumentation';

const draw = (examples: UsageExample[]) => render(UsageExamples, { props: { examples } }).body;

test('only titles and escaped code show calls with output or error comments', () => {
	const body = draw([
		{
			name: 'Call',
			description: 'Hidden description',
			call: 'choose("<script>")',
			input: null,
			output: false
		},
		{ name: 'Zero', call: 'choose(0)', input: 0, output: 0 },
		{ name: 'Null error', call: 'fail()', input: [], error: null }
	]);
	expect(body).toContain('&lt;script');
	expect(body).not.toContain('<script>');
	expect(body).toContain('false');
	expect(body).toContain('// throws null');
	expect(body).not.toContain('<table');
	expect(body).not.toContain('<details');
	expect(body).not.toContain('Hidden description');
	expect(body.match(/<article/g)).toHaveLength(3);
	expect(body.match(/<pre/g)).toHaveLength(3);
});

test('legacy inputs remain literal comments without inventing a call', () => {
	const body = draw([{ name: 'Undocumented call', input: { zero: 0, empty: null }, output: '' }]);
	expect(body).toContain('// Call not documented');
	expect(body).toContain('// Input:');
	expect(body).toContain('zero');
	expect(body).toContain('null');
	expect(body).not.toContain('Output changes');
});
