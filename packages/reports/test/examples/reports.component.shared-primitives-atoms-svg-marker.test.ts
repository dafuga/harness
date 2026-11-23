import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgMarker from '../../src/components/shared-primitives/atoms/SvgMarker.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgMarker, rendered on the server the way a caller renders it: the marker element
 * carries the props it is given, with no wrapper element around it and no marker-specific
 * behaviour of its own. Server render adds hydration comments around the element; they are
 * dropped so only the markup shows.
 */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-marker',
	symbol: 'SvgMarker',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});
const markup = (props: Record<string, unknown>) =>
	render(SvgMarker, { props: props as never }).body.replace(/<!--.*?-->/g, '');

test('Renders a marker with its attributes and no wrapper', () => {
	const inputs = [
		{ id: 'arrow-head', orient: 'auto', refX: 5, refY: 3 },
		{ id: 'dot', markerUnits: 'strokeWidth' }
	];
	const cases = inputs.map((input) => ({
		name: `a marker given ${JSON.stringify(input)}`,
		input,
		output: { body: markup(input) }
	}));
	recordExampleCases(where('renders-a-marker-with-its-attributes-and-no-wrapper'), cases);
	expect(cases[0].output.body).toBe(
		'<marker id="arrow-head" orient="auto" refX="5" refY="3"></marker>'
	);
	expect(cases[1].output.body).toBe('<marker id="dot" markerUnits="strokeWidth"></marker>');
	expect(cases[0].output.body).not.toMatch(/<(g|svg|div|span)\b/);
});

test('Renders the children snippet inside the marker', () => {
	const shape = createRawSnippet(() => ({
		render: () => '<path d="M0 0 L10 5 L0 10 z"></path>'
	}));
	const input = { id: 'arrow-head', orient: 'auto' };
	const body = markup({ ...input, children: shape });
	recordExampleCases(where('renders-the-children-snippet-inside-the-marker'), [
		{
			name: 'a marker given an id, orient and a children snippet drawing a triangle path',
			input: { ...input, children: 'snippet rendering <path d="M0 0 L10 5 L0 10 z">' },
			output: { body }
		}
	]);
	expect(body).toBe(
		'<marker id="arrow-head" orient="auto"><path d="M0 0 L10 5 L0 10 z"></path></marker>'
	);
	expect(body).not.toContain('children');
});

test('Renders an empty marker when no children are given', () => {
	const input = { id: 'empty-head' };
	const body = markup(input);
	recordExampleCases(where('renders-an-empty-marker-when-no-children-are-given'), [
		{ name: 'a marker given only an id', input, output: { body } }
	]);
	expect(body).toBe('<marker id="empty-head"></marker>');
});
