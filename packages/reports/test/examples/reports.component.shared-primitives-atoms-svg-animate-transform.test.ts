import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgAnimateTransform from '../../src/components/shared-primitives/atoms/SvgAnimateTransform.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgAnimateTransform component, rendered on the server the way its callers render it: with
 * example props and no DOM. Its markup is the evidence; the body is trimmed to the animateTransform
 * element itself.
 */

/** The evidence of one state: its cases, under the unit and the component they show. */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-animate-transform',
	symbol: 'SvgAnimateTransform',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/** The markup alone: Svelte's server render wraps it in hydration comments, which are dropped here. */
const markup = (html: string): string => html.replace(/<!--.*?-->/g, '');

/** A snippet child, as a caller passes it; it is not JSON, so cases record only its description. */
const spinChild = createRawSnippet(() => ({ render: () => '<desc>Spin the rect</desc>' }));

test('renders a bare animateTransform with no wrapper', () => {
	const body = markup(render(SvgAnimateTransform, { props: {} }).body);
	recordExampleCases(where('renders-a-bare-animatetransform-with-no-wrapper'), [
		{
			name: 'an animateTransform element is rendered with no props and no children',
			input: { props: {}, children: 'omitted' },
			output: { body }
		}
	]);
	expect(body).toBe('<animateTransform></animateTransform>');
	expect(body).not.toMatch(/<svg|<g|<div|<span/);
});

test('spreads attributes onto the animateTransform element', () => {
	const props = {
		attributeName: 'transform',
		type: 'rotate',
		from: '0 50 50',
		to: '360 50 50',
		dur: '2s',
		repeatCount: 'indefinite'
	};
	const body = markup(render(SvgAnimateTransform, { props }).body);
	recordExampleCases(where('spreads-attributes-onto-the-animatetransform-element'), [
		{
			name: 'a rotation passes its type, timing and values to the animateTransform element',
			input: { props },
			output: { body }
		}
	]);
	expect(body).toMatch(/^<animateTransform[^>]*>/);
	expect(body).toContain('attributeName="transform"');
	expect(body).toContain('type="rotate"');
	expect(body).toContain('from="0 50 50"');
	expect(body).toContain('to="360 50 50"');
	expect(body).toContain('dur="2s"');
	expect(body).toContain('repeatCount="indefinite"');
	expect(body).not.toContain('children');
});

test('renders supplied children inside the element', () => {
	const props = { attributeName: 'transform', type: 'rotate', dur: '1s' };
	const body = markup(
		render(SvgAnimateTransform, { props: { ...props, children: spinChild } }).body
	);
	recordExampleCases(where('renders-supplied-children-inside-the-element'), [
		{
			name: 'a snippet child is rendered inside the animateTransform element',
			input: { props, children: 'snippet: <desc>' },
			output: { body }
		}
	]);
	expect(body).toMatch(/^<animateTransform[^>]*><desc>Spin the rect<\/desc><\/animateTransform>$/);
	expect(body).not.toContain('children=');
});
