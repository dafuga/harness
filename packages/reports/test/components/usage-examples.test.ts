import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import UsageExamples from '../../src/components/usage-examples/UsageExamples.svelte';
import type { UsageExample } from '../../../../src/utils/unit-documentation/unitDocumentation';

const draw = (examples: UsageExample[]) => render(UsageExamples, { props: { examples } }).body;

test('authored calls and falsy results remain literal escaped code', () => {
	const body = draw([
		{ name: 'Call', call: 'choose("<script>")', input: null, output: false },
		{ name: 'Zero', call: 'choose(0)', input: 0, output: 0 },
		{ name: 'Null error', call: 'fail()', input: [], error: null }
	]);
	expect(body).toContain('&lt;script');
	expect(body).not.toContain('<script>');
	expect(body).toContain('false');
	expect(body).toContain('>0<');
	expect(body).toContain('null');
	expect(body).toContain('Expected error');
	expect(body.match(/Output changes from Example 01/g)).toHaveLength(2);
});

test('output comparison uses values rather than object property order', () => {
	const body = draw([
		{ name: 'Baseline', input: {}, output: { count: 0, flags: [false, null] } },
		{ name: 'Reordered', input: {}, output: { flags: [false, null], count: 0 } },
		{ name: 'Changed field', input: {}, output: { count: 1 } }
	]);
	expect(body).toContain('Same output as Example 01');
	expect(body.match(/Output changes from Example 01/g)).toHaveLength(1);
	expect(body).toContain('count');
	expect(body).toContain('flags');
	expect(body).toContain('Call not documented');
});

test('changing an output into an error is visible even when both contain null', () => {
	const body = draw([
		{ name: 'Null value', input: null, output: null },
		{ name: 'Null error', input: null, error: null }
	]);
	expect(body).toContain('Output changes from Example 01');
	expect(body).toContain('Expected error');
});
