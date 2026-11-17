import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgDefs from '../../src/components/shared-primitives/atoms/SvgDefs.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgDefs component, rendered on the server the way a caller renders it: with example
 * props only, and with a children snippet built here. The component is headless, so the markup it
 * produces is the whole output; the svg namespace is checked by the element carrying no wrapper.
 */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-defs',
	symbol: 'SvgDefs',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/** The markup without the server hydration markers, so only the element and its content remain. */
const markup = (body: string) => body.replace(/<!--[^>]*-->/g, '').trim();

test('Renders an empty defs element with no wrapper', () => {
	const body = markup(render(SvgDefs, { props: {} }).body);
	recordExampleCases(where('renders-an-empty-defs-element-with-no-wrapper'), [
		{ name: 'SvgDefs rendered with no props', input: {}, output: { body } }
	]);
	expect(body).toBe('<defs></defs>');
	expect(body.startsWith('<defs')).toBe(true);
});

test('Spreads given attributes onto the defs element', () => {
	const props = { id: 'shadow-filters', 'data-defs': 'shared' };
	const body = markup(render(SvgDefs, { props }).body);
	recordExampleCases(where('spreads-given-attributes-onto-the-defs-element'), [
		{
			name: 'SvgDefs rendered with an id and a data attribute and no children',
			input: props,
			output: { body }
		}
	]);
	expect(body).toMatch(/^<defs[^>]*\sid="shadow-filters"/);
	expect(body).toMatch(/<defs[^>]*\sdata-defs="shared"/);
	expect(body).toMatch(/><\/defs>$/);
	expect(body).not.toContain('children');
});

test('Renders the children snippet inside the defs element', () => {
	const children = createRawSnippet(() => ({
		render: () =>
			'<linearGradient id="ink"><stop offset="0" stop-color="currentColor"></stop></linearGradient>'
	}));
	const props = { id: 'ink-defs', children };
	const body = markup(render(SvgDefs, { props }).body);
	recordExampleCases(where('renders-the-children-snippet-inside-the-defs-element'), [
		{
			name: 'SvgDefs rendered with an id and a children snippet that draws a linear gradient',
			input: { id: 'ink-defs', children: 'snippet rendering a linearGradient named ink' },
			output: { body }
		}
	]);
	expect(body).toMatch(/^<defs[^>]*\sid="ink-defs"[^>]*>/);
	expect(body).toContain('<linearGradient id="ink">');
	expect(body.endsWith('</defs>')).toBe(true);
	expect(body).not.toMatch(/children=/);
});
