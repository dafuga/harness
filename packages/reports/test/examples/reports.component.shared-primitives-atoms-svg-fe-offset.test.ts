import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgFeOffset from '../../src/components/shared-primitives/atoms/SvgFeOffset.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgFeOffset component, rendered on the server the way a parent filter renders it:
 * props in, markup out. The server render adds hydration comments around the element; they are
 * stripped so the recorded markup is only the feOffset element and what it contains.
 */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-fe-offset',
	symbol: 'SvgFeOffset',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

const markup = (html: string): string => html.replace(/<!--[\s\S]*?-->/g, '');

/** The content a parent passes as the children snippet, with no arguments. */
const children = createRawSnippet(() => ({ render: () => '<desc>shift the source down</desc>' }));

test('Renders a native feOffset element with the forwarded attributes and no wrapper', () => {
	const props = { in: 'SourceAlpha', dx: '2', dy: '3', result: 'shifted' };
	const body = markup(render(SvgFeOffset, { props }).body);
	recordExampleCases(where('renders-a-native-feoffset-element-with-the-forwarded-attribu'), [
		{
			name: 'a filter offsets the alpha of its source by 2 and 3 and names the result',
			input: props,
			output: { body }
		}
	]);
	expect(body).toMatch(/^<feOffset [^>]*>/);
	expect(body).toContain('in="SourceAlpha"');
	expect(body).toContain('dx="2"');
	expect(body).toContain('dy="3"');
	expect(body).toContain('result="shifted"');
	expect(body).toMatch(/<\/feOffset>$/);
	expect(body.match(/<\/?[a-zA-Z]+/g)).toEqual(['<feOffset', '</feOffset']);
});

test('Renders the children snippet inside the feOffset element', () => {
	const body = markup(render(SvgFeOffset, { props: { dx: '4', children } }).body);
	recordExampleCases(where('renders-the-children-snippet-inside-the-feoffset-element'), [
		{
			name: 'a filter gives the offset a description snippet as children',
			input: { dx: '4', children: '<desc>shift the source down</desc>' },
			output: { body }
		}
	]);
	expect(body).toBe('<feOffset dx="4"><desc>shift the source down</desc></feOffset>');
	expect(body).not.toContain('children=');
});

test('Renders an empty feOffset element when children is omitted', () => {
	const body = markup(render(SvgFeOffset, { props: {} }).body);
	recordExampleCases(where('renders-an-empty-feoffset-element-when-children-is-omitted'), [
		{ name: 'no props at all, so no attributes and no children', input: {}, output: { body } }
	]);
	expect(body).toBe('<feOffset></feOffset>');
});
