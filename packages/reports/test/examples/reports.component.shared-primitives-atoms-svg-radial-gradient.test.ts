import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgRadialGradient from '../../src/components/shared-primitives/atoms/SvgRadialGradient.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgRadialGradient component, rendered on the server the way a caller renders it: with
 * example props only, and with a children snippet built here. The component is headless, so the
 * markup it produces is the whole output; the svg namespace is checked by the element carrying no
 * wrapper.
 */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-radial-gradient',
	symbol: 'SvgRadialGradient',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/** The markup without the server hydration markers, so only the element and its content remain. */
const markup = (body: string) => body.replace(/<!--[^>]*-->/g, '').trim();

test('Renders an empty radialGradient element with no wrapper', () => {
	const body = markup(render(SvgRadialGradient, { props: {} }).body);
	recordExampleCases(where('renders-an-empty-radialgradient-element-with-no-wrapper'), [
		{ name: 'SvgRadialGradient rendered with no props', input: {}, output: { body } }
	]);
	expect(body).toBe('<radialGradient></radialGradient>');
	expect(body.startsWith('<radialGradient')).toBe(true);
});

test('Spreads given attributes onto the radialGradient element', () => {
	const props = { id: 'glow', cx: '50%', cy: '50%', r: '50%', 'data-gradient': 'shared' };
	const body = markup(render(SvgRadialGradient, { props }).body);
	recordExampleCases(where('spreads-given-attributes-onto-the-radialgradient-element'), [
		{
			name: 'SvgRadialGradient rendered with an id, a centre, a radius and a data attribute',
			input: props,
			output: { body }
		}
	]);
	expect(body).toMatch(/^<radialGradient[^>]*\sid="glow"/);
	expect(body).toMatch(/<radialGradient[^>]*\scx="50%"/);
	expect(body).toMatch(/<radialGradient[^>]*\sr="50%"/);
	expect(body).toMatch(/<radialGradient[^>]*\sdata-gradient="shared"/);
	expect(body).toMatch(/><\/radialGradient>$/);
	expect(body).not.toContain('children');
});

test('Renders the children snippet inside the radialGradient element', () => {
	const children = createRawSnippet(() => ({
		render: () =>
			'<stop offset="0" stop-color="currentColor"></stop><stop offset="1" stop-opacity="0"></stop>'
	}));
	const props = { id: 'ink-glow', children };
	const body = markup(render(SvgRadialGradient, { props }).body);
	recordExampleCases(where('renders-the-children-snippet-inside-the-radialgradient-eleme'), [
		{
			name: 'SvgRadialGradient rendered with an id and a children snippet that draws two stops',
			input: { id: 'ink-glow', children: 'snippet rendering two stop elements' },
			output: { body }
		}
	]);
	expect(body).toMatch(/^<radialGradient[^>]*\sid="ink-glow"[^>]*>/);
	expect(body).toContain('<stop offset="0" stop-color="currentColor"></stop>');
	expect(body).toContain('<stop offset="1" stop-opacity="0"></stop>');
	expect(body.endsWith('</radialGradient>')).toBe(true);
	expect(body).not.toMatch(/children=/);
});
