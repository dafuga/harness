import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgFeFuncG from '../../src/components/shared-primitives/atoms/SvgFeFuncG.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

const withChildren = createRawSnippet(() => ({ render: () => '<feFuncG data-sample="child" />' }));

test('renders feFuncG with attributes and supplied child content', () => {
	const props = { id: 'green-channel', tableValues: '0 1', children: withChildren };
	const body = render(SvgFeFuncG, { props }).body.trim();
	expect(body).toContain('<feFuncG');
	expect(body).toContain('id="green-channel"');
	expect(body).toContain('tableValues="0 1"');
	expect(body).toContain('data-sample="child"');
	expect(body).toContain('</feFuncG>');
	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-svg-fe-func-g',
			symbol: 'SvgFeFuncG',
			state: 'renders-fefuncg-with-attributes-and-supplied-child-content',
			evidence: 'examples-cases',
			file: 'renders-fefuncg-with-attributes-and-supplied-child-content.json'
		},
		[
			{
				name: 'green channel with a child snippet',
				input: {
					id: props.id,
					tableValues: props.tableValues,
					children: '<feFuncG data-sample="child" />'
				},
				output: { body }
			}
		]
	);
});

test('renders an empty feFuncG when children are omitted', () => {
	const props = { id: 'green-channel' };
	const body = render(SvgFeFuncG, { props }).body.trim();
	expect(body).toContain('<feFuncG');
	expect(body).toContain('id="green-channel"');
	expect(body).toContain('</feFuncG>');
	expect(body).not.toContain('data-sample');
	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-svg-fe-func-g',
			symbol: 'SvgFeFuncG',
			state: 'renders-an-empty-fefuncg-when-children-are-omitted',
			evidence: 'examples-cases',
			file: 'renders-an-empty-fefuncg-when-children-are-omitted.json'
		},
		[{ name: 'green channel without children', input: props, output: { body } }]
	);
});
