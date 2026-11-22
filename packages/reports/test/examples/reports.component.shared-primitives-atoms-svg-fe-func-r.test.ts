import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import SvgFeFuncR from '../../src/components/shared-primitives/atoms/SvgFeFuncR.svelte';

test('renders feFuncR with forwarded attributes and children', () => {
	const props = {
		id: 'red-channel',
		amplitude: 0.8,
		children: createRawSnippet(() => ({ render: () => '<span>red response</span>' }))
	};
	const body = render(SvgFeFuncR, { props }).body;
	const markup = body.trim();

	expect(markup).toContain('<feFuncR');
	expect(markup).toContain('id="red-channel"');
	expect(markup).toContain('amplitude="0.8"');
	expect(markup).toContain('<span>red response</span>');
	expect(markup).not.toContain('<div');
	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-svg-fe-func-r',
			symbol: 'SvgFeFuncR',
			state: 'renders-fefuncr-with-forwarded-attributes-and-children',
			evidence: 'examples-cases',
			file: 'renders-fefuncr-with-forwarded-attributes-and-children.json'
		},
		[{ name: 'forwards SVG attributes and renders snippet content', input: props, output: { body: markup } }]
	);
});
