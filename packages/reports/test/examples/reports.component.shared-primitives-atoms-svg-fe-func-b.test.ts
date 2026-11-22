import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import SvgFeFuncB from '../../src/components/shared-primitives/atoms/SvgFeFuncB.svelte';

test('renders feFuncB with attributes and optional snippet content', () => {
	const cases = [
		{
			name: 'renders the native element without children',
			input: { props: { id: 'blue-channel', type: 'table' }, children: 'omitted' },
			output: {
				body: render(SvgFeFuncB, { props: { id: 'blue-channel', type: 'table' } }).body.trim()
			}
		},
		{
			name: 'renders its supplied snippet inside the native element',
			input: { props: { id: 'blue-channel' }, children: '<feFuncB content>' },
			output: {
				body: render(SvgFeFuncB, {
					props: {
						id: 'blue-channel',
						children: createRawSnippet(() => ({ render: () => '<feFuncB content>' }))
					}
				}).body.trim()
			}
		}
	];
	for (const { output } of cases) {
		expect(output.body).toMatch(/<feFuncB\b/);
		expect(output.body).not.toContain('<div');
	}
	expect(cases[0].output.body).toContain('id="blue-channel"');
	expect(cases[0].output.body).not.toContain('feFuncB content');
	expect(cases[1].output.body).toContain('<feFuncB content>');
	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-svg-fe-func-b',
			symbol: 'SvgFeFuncB',
			state: 'renders-fefuncb-with-attributes-and-optional-snippet-content',
			evidence: 'examples-cases',
			file: 'renders-fefuncb-with-attributes-and-optional-snippet-content.json'
		},
		cases
	);
});
