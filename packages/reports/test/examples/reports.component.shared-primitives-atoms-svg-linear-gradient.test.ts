import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgLinearGradient from '../../src/components/shared-primitives/atoms/SvgLinearGradient.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgLinearGradient, rendered on the server the way a defs block calls it: the
 * linearGradient element carries the props it is given, with no wrapper element around it and no
 * defaults of its own. Server render adds hydration comments around the element; they are dropped
 * so only the markup shows.
 */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-linear-gradient',
	symbol: 'SvgLinearGradient',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});
const markup = (props: Record<string, unknown>, children?: ReturnType<typeof createRawSnippet>) =>
	render(SvgLinearGradient, { props: { ...props, children } as never })
		.body.replace(/<!--.*?-->/g, '');

test('Renders a linearGradient with its attributes and no wrapper', () => {
	const inputs = [
		{ id: 'fade', x1: '0%', y1: '0%', x2: '100%', y2: '0%' },
		{ id: 'diagonal', x1: 0, y1: 0, x2: 1, y2: 1, gradientUnits: 'objectBoundingBox' }
	];
	const cases = inputs.map((input) => ({
		name: `a linearGradient given ${JSON.stringify(input)}`,
		input,
		output: { body: markup(input) }
	}));
	recordExampleCases(where('renders-a-lineargradient-with-its-attributes-and-no-wrapper'), cases);
	expect(cases[0].output.body).toBe(
		'<linearGradient id="fade" x1="0%" y1="0%" x2="100%" y2="0%"></linearGradient>'
	);
	expect(cases[1].output.body).toBe(
		'<linearGradient id="diagonal" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"></linearGradient>'
	);
	expect(cases[0].output.body).not.toMatch(/<(g|svg|div|span)\b/);
});

test('Renders the children snippet as the only content', () => {
	const stops = createRawSnippet(() => ({
		render: () => '<stop offset="0%" stop-color="#1d4ed8"></stop>'
	}));
	const input = { id: 'brand', x1: '0%', x2: '100%' };
	const body = markup(input, stops);
	recordExampleCases(where('renders-the-children-snippet-as-the-only-content'), [
		{
			name: 'a linearGradient given an id, x1, x2 and a stop snippet',
			input: { ...input, children: 'snippet rendering one blue stop' },
			output: { body }
		}
	]);
	expect(body).toBe(
		'<linearGradient id="brand" x1="0%" x2="100%"><stop offset="0%" stop-color="#1d4ed8"></stop></linearGradient>'
	);
	expect(body).not.toContain('children');
});

test('Renders an empty gradient when no children are given', () => {
	const input = { id: 'empty' };
	const body = markup(input);
	recordExampleCases(where('renders-an-empty-gradient-when-no-children-are-given'), [
		{ name: 'a linearGradient given only an id', input, output: { body } }
	]);
	expect(body).toBe('<linearGradient id="empty"></linearGradient>');
});
