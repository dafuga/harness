import { render } from 'svelte/server';
import { test } from 'vitest';
import HtmlWbr from '../../src/components/shared-primitives/atoms/HtmlWbr.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

test('renders a native wbr with forwarded attributes and no content', () => {
	const props = { title: 'Optional word break', 'data-example': 'break-point' };
	const body = render(HtmlWbr, { props }).body.trim();
	const markup = body.replace(/<!--[\s\S]*?-->/g, '').trim();
	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-html-wbr',
			symbol: 'HtmlWbr',
			state: 'renders-a-native-wbr-with-forwarded-attributes-and-no-conten',
			evidence: 'examples-cases',
			file: 'renders-a-native-wbr-with-forwarded-attributes-and-no-conten.json'
		},
		[
			{
				name: 'a word break carrying caller attributes',
				input: props,
				output: { body: markup }
			}
		]
	);
	expect(body).toContain('<wbr');
	expect(body).toContain('title="Optional word break"');
	expect(body).toContain('data-example="break-point"');
	expect(markup).toMatch(/^<wbr\b[^>]*\/?>(?:\s*)$/);
});
