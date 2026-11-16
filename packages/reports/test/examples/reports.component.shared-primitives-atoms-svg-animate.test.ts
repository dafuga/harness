import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgAnimate from '../../src/components/shared-primitives/atoms/SvgAnimate.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgAnimate component, rendered on the server the way its callers render it: with example
 * props and no DOM. Its markup is the evidence; the body is trimmed to the animate element itself.
 */

/** The evidence of one state: its cases, under the unit and the component they show. */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-animate',
	symbol: 'SvgAnimate',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/** The markup alone: Svelte's server render wraps it in hydration comments, which are dropped here. */
const markup = (html: string): string => html.replace(/<!--.*?-->/g, '');

/** A snippet child, as a caller passes it; it is not JSON, so cases record only its description. */
const pulseChild = createRawSnippet(() => ({ render: () => '<desc>Pulse the opacity</desc>' }));

test('renders a bare animate element with no wrapper', () => {
	const body = markup(render(SvgAnimate, { props: {} }).body);
	recordExampleCases(where('renders-a-bare-animate-element-with-no-wrapper'), [
		{
			name: 'an animate element is rendered with no props and no children',
			input: { props: {}, children: 'omitted' },
			output: { body }
		}
	]);
	expect(body).toBe('<animate></animate>');
	expect(body).not.toMatch(/<svg|<g|<div|<span/);
});

test('spreads attributes onto the animate element', () => {
	const props = {
		attributeName: 'opacity',
		from: '0',
		to: '1',
		dur: '2s',
		repeatCount: 'indefinite'
	};
	const body = markup(render(SvgAnimate, { props }).body);
	recordExampleCases(where('spreads-attributes-onto-the-animate-element'), [
		{
			name: 'an opacity fade passes its timing and values to the animate element',
			input: { props },
			output: { body }
		}
	]);
	expect(body).toMatch(/^<animate[^>]*>/);
	expect(body).toContain('attributeName="opacity"');
	expect(body).toContain('from="0"');
	expect(body).toContain('to="1"');
	expect(body).toContain('dur="2s"');
	expect(body).toContain('repeatCount="indefinite"');
	expect(body).not.toContain('children');
});

test('renders supplied children inside the animate element', () => {
	const body = markup(
		render(SvgAnimate, {
			props: { attributeName: 'r', dur: '1s', children: pulseChild }
		}).body
	);
	recordExampleCases(where('renders-supplied-children-inside-the-animate-element'), [
		{
			name: 'a snippet child is rendered inside the animate element',
			input: { props: { attributeName: 'r', dur: '1s' }, children: 'snippet: <desc>' },
			output: { body }
		}
	]);
	expect(body).toMatch(/^<animate[^>]*><desc>Pulse the opacity<\/desc><\/animate>$/);
	expect(body).not.toContain('children=');
});
