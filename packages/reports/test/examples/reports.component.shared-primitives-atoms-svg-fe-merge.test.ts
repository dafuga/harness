import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgFeMerge from '../../src/components/shared-primitives/atoms/SvgFeMerge.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgFeMerge component, rendered on the server the way the reports app renders SVG
 * primitives: with example props and no browser. The component adds no wrapper DOM, so the body
 * is the native feMerge element itself, trimmed here to the markup that matters.
 */

/** The evidence of one state: its cases, under the unit and the component they show. */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-fe-merge',
	symbol: 'SvgFeMerge',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/** The body of a render with Svelte's hydration comment markers and surrounding whitespace removed. */
const markup = (body: string) => body.replace(/<!--[\s\S]*?-->/g, '').trim();

test('Renders a bare feMerge element with its attributes and no wrapper when no children are given', () => {
	const props = { id: 'merge-glow', 'data-layer': 'glow' };
	const body = markup(render(SvgFeMerge, { props }).body);
	recordExampleCases(where('renders-a-bare-femerge-element-with-its-attributes-and-no-wr'), [
		{
			name: 'a merge with an id and a data attribute is rendered without children',
			input: { props },
			output: { body }
		}
	]);
	// No wrapper: the only element is feMerge itself, with the spread attributes and no content.
	expect(body).toBe('<feMerge id="merge-glow" data-layer="glow"></feMerge>');
});

test('Renders a supplied children snippet inside the feMerge element', () => {
	const children = createRawSnippet(() => ({
		render: () =>
			'<feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode>'
	}));
	const props = { id: 'merge-stack', children };
	const body = markup(render(SvgFeMerge, { props }).body);
	recordExampleCases(where('renders-a-supplied-children-snippet-inside-the-femerge-eleme'), [
		{
			name: 'a merge with two merge nodes passed as its children snippet',
			input: {
				props: { id: 'merge-stack' },
				children: [
					'<feMergeNode in="blur"></feMergeNode>',
					'<feMergeNode in="SourceGraphic"></feMergeNode>'
				]
			},
			output: { body }
		}
	]);
	// The snippet's two merge nodes sit directly inside feMerge, which is the outermost element.
	expect(body).toBe(
		'<feMerge id="merge-stack"><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge>'
	);
	expect(body).not.toContain('children=');
});
