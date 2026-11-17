import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgFeBlend from '../../src/components/shared-primitives/atoms/SvgFeBlend.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgFeBlend component, rendered on the server the way a parent filter renders it:
 * props in, markup out. The server render adds hydration comments around the element; they are
 * stripped so the recorded markup is only the feBlend element and what it contains.
 */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-fe-blend',
	symbol: 'SvgFeBlend',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

const markup = (html: string): string => html.replace(/<!--[\s\S]*?-->/g, '');

/** The content a parent passes as the children snippet, with no arguments. */
const children = createRawSnippet(() => ({ render: () => '<desc>blend the two inputs</desc>' }));

test('Renders a native feBlend element with the forwarded attributes and no wrapper', () => {
	const props = { in: 'SourceGraphic', in2: 'BackgroundImage', mode: 'multiply', result: 'blend' };
	const body = markup(render(SvgFeBlend, { props }).body);
	recordExampleCases(where('renders-a-native-feblend-element-with-the-forwarded-attribut'), [
		{
			name: 'a filter passes two inputs, a multiply mode and a result name',
			input: props,
			output: { body }
		}
	]);
	expect(body).toMatch(/^<feBlend [^>]*>/);
	expect(body).toContain('in="SourceGraphic"');
	expect(body).toContain('in2="BackgroundImage"');
	expect(body).toContain('mode="multiply"');
	expect(body).toContain('result="blend"');
	expect(body).toMatch(/<\/feBlend>$/);
	expect(body.match(/<\/?[a-zA-Z]+/g)).toEqual(['<feBlend', '</feBlend']);
});

test('Renders the children snippet inside the feBlend element', () => {
	const body = markup(render(SvgFeBlend, { props: { mode: 'screen', children } }).body);
	recordExampleCases(where('renders-the-children-snippet-inside-the-feblend-element'), [
		{
			name: 'a filter gives the blend a description snippet as children',
			input: { mode: 'screen', children: '<desc>blend the two inputs</desc>' },
			output: { body }
		}
	]);
	expect(body).toBe('<feBlend mode="screen"><desc>blend the two inputs</desc></feBlend>');
	expect(body).not.toContain('children=');
});

test('Renders an empty feBlend element when children is omitted', () => {
	const body = markup(render(SvgFeBlend, { props: {} }).body);
	recordExampleCases(where('renders-an-empty-feblend-element-when-children-is-omitted'), [
		{ name: 'no props at all, so no attributes and no children', input: {}, output: { body } }
	]);
	expect(body).toBe('<feBlend></feBlend>');
});

test('Forwards a mode the component does not validate, unchanged', () => {
	const props = { mode: 'not-a-blend-mode' };
	const body = markup(render(SvgFeBlend, { props }).body);
	recordExampleCases(where('forwards-a-mode-the-component-does-not-validate-unchanged'), [
		{ name: 'an unknown blend mode is passed through as written', input: props, output: { body } }
	]);
	expect(body).toBe('<feBlend mode="not-a-blend-mode"></feBlend>');
});
