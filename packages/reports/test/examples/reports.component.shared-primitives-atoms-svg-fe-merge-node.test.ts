import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgFeMergeNode from '../../src/components/shared-primitives/atoms/SvgFeMergeNode.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgFeMergeNode, rendered by the server renderer the way a filter's markup is rendered:
 * no browser, no port. The component names no wrapper, so the markup is the native feMergeNode
 * element itself, with its forwarded attributes and the optional children inside it.
 */
const symbol = 'SvgFeMergeNode';

/** The evidence of one state: its cases, under the unit and the component they show. */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-fe-merge-node',
	symbol,
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/** The markup without the renderer's hydration comments, which carry no element of their own. */
const markupOf = (body: string) => body.replace(/<!--[\s\S]*?-->/g, '');

/** The opening tag of the one element the component renders. */
const openingTag = (markup: string) => markup.match(/<feMergeNode\b[^>]*>/)?.[0] ?? '';

test('an element without children renders as an empty native feMergeNode', () => {
	const props = {};
	const markup = markupOf(render(SvgFeMergeNode, { props }).body);
	recordExampleCases(where('an-element-without-children-renders-as-an-empty-native-femer'), [
		{ name: 'no children snippet is given', input: props, output: { markup } }
	]);
	expect(markup).toMatch(/^<feMergeNode\b[^>]*><\/feMergeNode>$/);
	expect(markup).not.toContain('<g');
	expect(markup).not.toContain('<svg');
});

test('forwarded attributes land on the feMergeNode element as given', () => {
	const props = { in: 'SourceGraphic', result: 'blurred' };
	const markup = markupOf(render(SvgFeMergeNode, { props }).body);
	recordExampleCases(where('forwarded-attributes-land-on-the-femergenode-element-as-give'), [
		{ name: 'in and result are forwarded to the element', input: props, output: { markup } }
	]);
	expect(openingTag(markup)).toContain('in="SourceGraphic"');
	expect(openingTag(markup)).toContain('result="blurred"');
	expect(markup).toMatch(/^<feMergeNode\b[^>]*><\/feMergeNode>$/);
});

test('a children snippet renders inside the feMergeNode element', () => {
	const children = createRawSnippet(() => ({
		render: () => '<text>caption</text>'
	}));
	const props = { in: 'SourceGraphic', children };
	const markup = markupOf(render(SvgFeMergeNode, { props }).body);
	recordExampleCases(where('a-children-snippet-renders-inside-the-femergenode-element'), [
		{
			name: 'a snippet with one text node is given as children',
			input: { in: 'SourceGraphic', children: '<text>caption</text>' },
			output: { markup }
		}
	]);
	expect(markup).toMatch(/^<feMergeNode\b[^>]*><text>caption<\/text><\/feMergeNode>$/);
	expect(openingTag(markup)).toContain('in="SourceGraphic"');
});
