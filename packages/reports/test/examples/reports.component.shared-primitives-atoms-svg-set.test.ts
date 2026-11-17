import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { test } from 'vitest';
import SvgSet from '../../src/components/shared-primitives/atoms/SvgSet.svelte';

test('forwards set attributes and renders its child snippet', () => {
	const props = {
		attributeName: 'opacity',
		to: '0',
		begin: '2s',
		children: createRawSnippet(() => ({ render: () => '<animate dur="1s" />' }))
	};
	const rendered = render(SvgSet, { props }).body;
	const body = rendered.match(/<set\b[\s\S]*?<\/set>/)?.[0];

	expect(body).toBeDefined();
	expect(body).toContain('attributeName="opacity"');
	expect(body).toContain('to="0"');
	expect(body).toContain('<animate dur="1s"');
	expect(body).not.toContain('children=');
	expect(rendered.match(/<set\b/g)).toHaveLength(1);

	const withoutChildren = render(SvgSet, { props: { attributeName: 'visibility', to: 'hidden' } }).body;
	const emptyElement = withoutChildren.match(/<set\b[\s\S]*?<\/set>/)?.[0];
	expect(emptyElement).toBeDefined();
	expect(emptyElement).toContain('attributeName="visibility"');
	expect(emptyElement).not.toContain('children=');

	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-svg-set',
			symbol: 'SvgSet',
			state: 'forwards-set-attributes-and-renders-its-child-snippet',
			evidence: 'examples-cases',
			file: 'forwards-set-attributes-and-renders-its-child-snippet.json'
		},
		[
			{
				name: 'native set receives attributes and child markup',
				input: { attributeName: 'opacity', to: '0', begin: '2s', child: '<animate dur="1s" />' },
				output: { body: body?.trim() }
			},
			{
				name: 'native set renders without optional children',
				input: { attributeName: 'visibility', to: 'hidden' },
				output: { body: emptyElement?.trim() }
			}
		]
	);
});
