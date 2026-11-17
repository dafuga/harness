import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgFeDiffuseLighting from '../../src/components/shared-primitives/atoms/SvgFeDiffuseLighting.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgFeDiffuseLighting component, rendered on the server the way its callers render it:
 * with example props and no wrapper around it. Its one job is the native feDiffuseLighting element,
 * so each state shows that element with and without its children snippet. Svelte's hydration
 * comments are dropped from the recorded markup, since they describe no element.
 */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-fe-diffuse-lighting',
	symbol: 'SvgFeDiffuseLighting',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

const markup = (body: string): string => body.replace(/<!--.*?-->/g, '').trim();

const lighting = {
	surfaceScale: 2,
	diffuseConstant: 1,
	'lighting-color': '#ffffff',
	result: 'diffuse'
};

test('Renders a bare feDiffuseLighting with its attributes', () => {
	const bare = markup(render(SvgFeDiffuseLighting, { props: lighting }).body);
	const nullChildren = markup(
		render(SvgFeDiffuseLighting, { props: { ...lighting, children: null } }).body
	);
	recordExampleCases(where('renders-a-bare-fediffuselighting-with-its-attributes'), [
		{
			name: 'a diffuse lighting with surface scale, constant and colour and no children',
			input: lighting,
			output: { body: bare }
		},
		{
			name: 'the same lighting with a null children value renders no content',
			input: { ...lighting, children: null },
			output: { body: nullChildren }
		}
	]);
	expect(bare).toMatch(/^<feDiffuseLighting [^>]*>/);
	expect(bare).toMatch(/<\/feDiffuseLighting>$/);
	expect(bare.match(/<feDiffuseLighting/g)).toHaveLength(1);
	expect(bare).toContain('surfaceScale="2"');
	expect(bare).toContain('diffuseConstant="1"');
	expect(bare).toContain('lighting-color="#ffffff"');
	expect(bare).toContain('result="diffuse"');
	expect(bare).not.toContain('children');
	expect(nullChildren).toBe(bare);
});

test('Renders the children snippet inside the feDiffuseLighting', () => {
	const children = createRawSnippet(() => ({
		render: () => '<title>Soft light</title>'
	}));
	const body = markup(render(SvgFeDiffuseLighting, { props: { ...lighting, children } }).body);
	recordExampleCases(where('renders-the-children-snippet-inside-the-fediffuselighting'), [
		{
			name: 'a diffuse lighting whose children snippet renders a title',
			input: { ...lighting, children: 'snippet rendering <title>Soft light</title>' },
			output: { body }
		}
	]);
	expect(body).toMatch(/^<feDiffuseLighting [^>]*>/);
	expect(body).toContain('<title>Soft light</title></feDiffuseLighting>');
	expect(body).not.toContain('children=');
	expect(body.match(/<feDiffuseLighting/g)).toHaveLength(1);
});
