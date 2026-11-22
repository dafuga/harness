import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgDesc from '../../src/components/shared-primitives/atoms/SvgDesc.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgDesc component, rendered on the server the way a caller renders it: with example
 * props only, and with a children snippet built here. The component is headless, so the markup it
 * produces is the whole output; the desc element carrying no wrapper is checked on each state.
 */

/** The markup without the server hydration markers, so only the element and its content remain. */
const markup = (body: string) => body.replace(/<!--[^>]*-->/g, '').trim();

test('Renders an empty desc element with no wrapper', () => {
	const body = markup(render(SvgDesc, { props: {} }).body);
	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-svg-desc',
			symbol: 'SvgDesc',
			state: 'renders-an-empty-desc-element-with-no-wrapper',
			evidence: 'examples-cases',
			file: 'renders-an-empty-desc-element-with-no-wrapper.json'
		},
		[{ name: 'SvgDesc rendered with no props', input: {}, output: { body } }]
	);
	expect(body).toBe('<desc></desc>');
	expect(body.startsWith('<desc')).toBe(true);
});

test('Spreads given attributes onto the desc element', () => {
	const props = { id: 'chart-summary', 'data-desc': 'shared' };
	const body = markup(render(SvgDesc, { props }).body);
	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-svg-desc',
			symbol: 'SvgDesc',
			state: 'spreads-given-attributes-onto-the-desc-element',
			evidence: 'examples-cases',
			file: 'spreads-given-attributes-onto-the-desc-element.json'
		},
		[
			{
				name: 'SvgDesc rendered with an id and a data attribute and no children',
				input: props,
				output: { body }
			}
		]
	);
	expect(body).toMatch(/^<desc[^>]*\sid="chart-summary"/);
	expect(body).toMatch(/<desc[^>]*\sdata-desc="shared"/);
	expect(body).toMatch(/><\/desc>$/);
	expect(body).not.toContain('children');
});

test('Renders the children snippet inside the desc element', () => {
	const children = createRawSnippet(() => ({
		render: () => 'Bar chart of weekly passing runs, one bar per report'
	}));
	const props = { id: 'chart-caption', children };
	const body = markup(render(SvgDesc, { props }).body);
	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-svg-desc',
			symbol: 'SvgDesc',
			state: 'renders-the-children-snippet-inside-the-desc-element',
			evidence: 'examples-cases',
			file: 'renders-the-children-snippet-inside-the-desc-element.json'
		},
		[
			{
				name: 'SvgDesc rendered with an id and a children snippet that writes a description',
				input: { id: 'chart-caption', children: 'snippet writing a bar chart description' },
				output: { body }
			}
		]
	);
	expect(body).toMatch(/^<desc[^>]*\sid="chart-caption"[^>]*>/);
	expect(body).toContain('Bar chart of weekly passing runs, one bar per report');
	expect(body.endsWith('</desc>')).toBe(true);
	expect(body).not.toMatch(/children=/);
});
