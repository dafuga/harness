import { test } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import SvgFeDistantLight from '../../src/components/shared-primitives/atoms/SvgFeDistantLight.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgFeDistantLight component, rendered on the server with example props. Svelte's
 * server output carries block comment markers around the children; they are removed so the
 * recorded markup shows only the element and what it holds.
 */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-fe-distant-light',
	symbol: 'SvgFeDistantLight',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

const markupOf = (body: string): string => body.replace(/<!--[^>]*-->/g, '');

test('renders a bare feDistantLight element with no child content', () => {
	const body = markupOf(render(SvgFeDistantLight, { props: {} }).body);
	recordExampleCases(where('renders-a-bare-fedistantlight-element-with-no-child-content'), [
		{
			name: 'the component is rendered with no props and no children',
			input: { props: {} },
			output: { body }
		}
	]);
	expect(body).toBe('<feDistantLight></feDistantLight>');
	expect(body).not.toMatch(/<svg/);
});

test('passes the light attributes through to the element', () => {
	const props = { azimuth: 45, elevation: 30, 'data-light': 'key' };
	const body = markupOf(render(SvgFeDistantLight, { props }).body);
	recordExampleCases(where('passes-the-light-attributes-through-to-the-element'), [
		{
			name: 'azimuth, elevation and a data attribute are spread onto the element',
			input: { props },
			output: { body }
		}
	]);
	expect(body).toMatch(/^<feDistantLight[^>]*\sazimuth="45"/);
	expect(body).toContain('elevation="30"');
	expect(body).toContain('data-light="key"');
	expect(body.startsWith('<feDistantLight')).toBe(true);
	expect(body.endsWith('</feDistantLight>')).toBe(true);
});

test('renders the children snippet inside the element', () => {
	const children = createRawSnippet(() => ({
		render: () => '<title>Key light</title>'
	}));
	const body = markupOf(render(SvgFeDistantLight, { props: { children } }).body);
	recordExampleCases(where('renders-the-children-snippet-inside-the-element'), [
		{
			name: 'a snippet rendering a title is passed as children',
			input: { props: { children: 'snippet rendering <title>Key light</title>' } },
			output: { body }
		}
	]);
	expect(body).toBe('<feDistantLight><title>Key light</title></feDistantLight>');
});

test('passes an invalid attribute value through without validation', () => {
	const props = { azimuth: 'not-a-number' };
	const body = markupOf(render(SvgFeDistantLight, { props }).body);
	recordExampleCases(where('passes-an-invalid-attribute-value-through-without-validation'), [
		{
			name: 'a non-numeric azimuth is rendered as given',
			input: { props },
			output: { body }
		}
	]);
	expect(body).toBe('<feDistantLight azimuth="not-a-number"></feDistantLight>');
});
