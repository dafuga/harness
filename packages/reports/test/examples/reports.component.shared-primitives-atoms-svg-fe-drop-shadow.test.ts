import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgFeDropShadow from '../../src/components/shared-primitives/atoms/SvgFeDropShadow.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgFeDropShadow component, rendered on the server the way its callers render it: with
 * example props and no wrapper around it. Its one job is the native feDropShadow element, so each
 * state shows what that element looks like with and without its children snippet. Svelte's
 * hydration comments are dropped from the recorded markup, since they describe no element.
 */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-fe-drop-shadow',
	symbol: 'SvgFeDropShadow',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

const markup = (body: string): string => body.replace(/<!--.*?-->/g, '').trim();

const shadow = {
	dx: 2,
	dy: 4,
	stdDeviation: 3,
	'flood-color': '#000000',
	'flood-opacity': 0.25
};

test('Renders a bare feDropShadow with its attributes', () => {
	const body = markup(render(SvgFeDropShadow, { props: shadow }).body);
	recordExampleCases(where('renders-a-bare-fedropshadow-with-its-attributes'), [
		{
			name: 'a shadow with offsets, blur and flood colour and no children',
			input: shadow,
			output: { body }
		}
	]);
	expect(body).toMatch(/^<feDropShadow [^>]*>/);
	expect(body).toMatch(/<\/feDropShadow>$/);
	expect(body.match(/<feDropShadow/g)).toHaveLength(1);
	expect(body).toContain('dx="2"');
	expect(body).toContain('stdDeviation="3"');
	expect(body).toContain('flood-color="#000000"');
	expect(body).not.toContain('children');
});

test('Renders the children snippet inside the feDropShadow', () => {
	const children = createRawSnippet(() => ({
		render: () => '<title>Soft shadow</title>'
	}));
	const body = markup(render(SvgFeDropShadow, { props: { ...shadow, children } }).body);
	recordExampleCases(where('renders-the-children-snippet-inside-the-fedropshadow'), [
		{
			name: 'a shadow whose children snippet renders a title',
			input: { ...shadow, children: 'snippet rendering <title>Soft shadow</title>' },
			output: { body }
		}
	]);
	expect(body).toMatch(/^<feDropShadow [^>]*>/);
	expect(body).toContain('<title>Soft shadow</title></feDropShadow>');
	expect(body).not.toContain('children=');
	expect(body.match(/<feDropShadow/g)).toHaveLength(1);
});
