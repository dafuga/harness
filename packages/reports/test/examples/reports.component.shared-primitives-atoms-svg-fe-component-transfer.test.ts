import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgFeComponentTransfer from '../../src/components/shared-primitives/atoms/SvgFeComponentTransfer.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgFeComponentTransfer component, rendered on the server the way the reports app renders
 * SVG primitives: with example props and no browser. The component adds no wrapper DOM, so the body
 * is the native feComponentTransfer element itself, trimmed here to the markup that matters.
 */

/** The evidence of one state: its cases, under the unit and the component they show. */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-fe-component-transfer',
	symbol: 'SvgFeComponentTransfer',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/** The body of a render with Svelte's hydration comment markers and surrounding whitespace removed. */
const markup = (body: string) => body.replace(/<!--[\s\S]*?-->/g, '').trim();

test('Renders a bare feComponentTransfer element with its attributes and no wrapper', () => {
	const props = { id: 'tone-curve', in: 'SourceGraphic', result: 'toned' };
	const body = markup(render(SvgFeComponentTransfer, { props }).body);
	recordExampleCases(where('renders-a-bare-fecomponenttransfer-element-with-its-attribut'), [
		{
			name: 'a component transfer with an id, an input and a result name, without children',
			input: { props },
			output: { body }
		}
	]);
	// No wrapper: the only element is feComponentTransfer itself, with the spread attributes and no content.
	expect(body).toBe('<feComponentTransfer id="tone-curve" in="SourceGraphic" result="toned"></feComponentTransfer>');
	expect(body).not.toContain('children=');
});

test('Renders a supplied children snippet inside the feComponentTransfer element', () => {
	const children = createRawSnippet(() => ({
		render: () => '<feFuncR type="table" tableValues="0 1"></feFuncR><feFuncG type="identity"></feFuncG>'
	}));
	const props = { id: 'tone-curve', children };
	const body = markup(render(SvgFeComponentTransfer, { props }).body);
	recordExampleCases(where('renders-a-supplied-children-snippet-inside-the-fecomponenttr'), [
		{
			name: 'a component transfer with a red table function and a green identity function as children',
			input: {
				props: { id: 'tone-curve' },
				children: [
					'<feFuncR type="table" tableValues="0 1"></feFuncR>',
					'<feFuncG type="identity"></feFuncG>'
				]
			},
			output: { body }
		}
	]);
	// The snippet's transfer functions sit directly inside feComponentTransfer, which is the outermost element.
	expect(body).toBe(
		'<feComponentTransfer id="tone-curve"><feFuncR type="table" tableValues="0 1"></feFuncR><feFuncG type="identity"></feFuncG></feComponentTransfer>'
	);
	expect(body).not.toContain('children=');
});

test('Renders an empty feComponentTransfer element when children is omitted', () => {
	const body = markup(render(SvgFeComponentTransfer, { props: {} }).body);
	recordExampleCases(where('renders-an-empty-fecomponenttransfer-element-when-children-i'), [
		{ name: 'no props at all, so no attributes and no children', input: {}, output: { body } }
	]);
	expect(body).toBe('<feComponentTransfer></feComponentTransfer>');
});
