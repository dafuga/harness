import { render } from 'svelte/server';
import type { Snippet } from 'svelte';
import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import HtmlInputHidden from '../../src/components/shared-primitives/atoms/HtmlInputHidden.svelte';

test('renders one hidden input and omits children', () => {
	const props = {
		type: 'text',
		name: 'csrf-token',
		value: 'example-token',
		children: (() => {}) as Snippet
	};
	const body = render(HtmlInputHidden, { props }).body.trim();

	expect(body).toContain('<input');
	expect(body).toContain('type="hidden"');
	expect(body).toContain('name="csrf-token"');
	expect(body).toContain('value="example-token"');
	expect(body).not.toContain('type="text"');
	expect(body).not.toContain('children=');
	expect(body).not.toContain('</');

	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-html-input-hidden',
			symbol: 'HtmlInputHidden',
			state: 'renders-one-hidden-input-and-omits-children',
			evidence: 'examples-cases',
			file: 'renders-one-hidden-input-and-omits-children.json'
		},
		[
			{
				name: 'overrides supplied type and renders native attributes',
				input: {
					type: 'text',
					name: 'csrf-token',
					value: 'example-token',
					children: 'provided snippet'
				},
				output: { body: '<input type="hidden" name="csrf-token" value="example-token">' }
			}
		]
	);
});
