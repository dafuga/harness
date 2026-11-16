import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgFeComposite from '../../src/components/shared-primitives/atoms/SvgFeComposite.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

test('renders a native feComposite with forwarded attributes and optional children', () => {
	const props = { in: 'SourceGraphic', operator: 'over', result: 'merged' };
	const children = createRawSnippet(() => ({ render: () => '<feFuncA slope="0.5" />' }));
	const withChildren = render(SvgFeComposite, { props: { ...props, children } }).body.trim();
	const withoutChildren = render(SvgFeComposite, { props }).body.trim();
	const state = 'renders-a-native-fecomposite-with-forwarded-attributes-and-o';
	const markup = (body: string) => body.replace(/\s+/g, ' ');

	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-svg-fe-composite',
			symbol: 'SvgFeComposite',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'attributes and snippet content are rendered on the native element',
				input: { ...props, children: '<feFuncA slope="0.5" />' },
				output: { body: markup(withChildren) }
			},
			{
				name: 'omitted children render no child content',
				input: props,
				output: { body: markup(withoutChildren) }
			}
		]
	);

	expect(withChildren).toContain('<feComposite');
	expect(withChildren).toContain('operator="over"');
	expect(withChildren).toContain('<feFuncA slope="0.5"');
	expect(withoutChildren).toContain('<feComposite');
	expect(withoutChildren).not.toContain('feFuncA');
});
