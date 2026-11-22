import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgFeFuncA from '../../src/components/shared-primitives/atoms/SvgFeFuncA.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgFeFuncA component, rendered on the server the way a parent filter renders it: its
 * attributes are spread onto a native feFuncA element and nothing else is added around it.
 */
const symbol = 'SvgFeFuncA';

/** The evidence of one state: its cases, under the unit and the component they show. */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-fe-func-a',
	symbol,
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/** The markup without Svelte's hydration comments, so only the element itself is compared. */
const markup = (body: string): string => body.replace(/<!--[\s\S]*?-->/g, '');

test('Renders a bare feFuncA carrying its attributes', () => {
	const props = { type: 'gamma', amplitude: 1.2, exponent: 2.2, offset: 0.05 };
	const { body } = render(SvgFeFuncA, { props });
	const html = markup(body);
	recordExampleCases(where('renders-a-bare-fefunca-carrying-its-attributes'), [
		{
			name: 'a gamma transfer function is given its amplitude, exponent and offset',
			input: { props },
			output: { markup: html }
		}
	]);
	expect(html).toMatch(/^<feFuncA type="gamma" amplitude="1.2" exponent="2.2" offset="0.05"><\/feFuncA>$/);
	expect(html).not.toMatch(/<svg|<g\b|<div|<span/);
});

test('Renders the supplied snippet as the feFuncA content', () => {
	const props = { type: 'table', tableValues: '0 0.5 1' };
	const children = createRawSnippet(() => ({
		render: () => '<title>Lift shadows</title>'
	}));
	const { body } = render(SvgFeFuncA, { props: { ...props, children } });
	const html = markup(body);
	recordExampleCases(where('renders-the-supplied-snippet-as-the-fefunca-content'), [
		{
			name: 'a table transfer function with a title snippet as its content',
			input: { props, children: 'snippet: <title>Lift shadows</title>' },
			output: { markup: html }
		}
	]);
	expect(html).toBe('<feFuncA type="table" tableValues="0 0.5 1"><title>Lift shadows</title></feFuncA>');
});

test('Omitted children leave the feFuncA empty', () => {
	const props = { type: 'identity' };
	const { body } = render(SvgFeFuncA, { props });
	const html = markup(body);
	recordExampleCases(where('omitted-children-leave-the-fefunca-empty'), [
		{
			name: 'an identity transfer function is given no children',
			input: { props },
			output: { markup: html }
		}
	]);
	expect(html).toBe('<feFuncA type="identity"></feFuncA>');
});
