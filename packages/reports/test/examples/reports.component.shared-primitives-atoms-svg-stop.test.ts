import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgStop from '../../src/components/shared-primitives/atoms/SvgStop.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgStop, rendered on the server the way a gradient calls it: the stop element carries
 * the props it is given, with no wrapper element around it and no defaults of its own. Server
 * render adds hydration comments around the element; they are dropped so only the markup shows.
 */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-stop',
	symbol: 'SvgStop',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});
const markup = (props: Record<string, unknown>, children?: ReturnType<typeof createRawSnippet>) =>
	render(SvgStop, { props: { ...props, children } as never }).body.replace(/<!--.*?-->/g, '');

test('Renders a stop with its attributes and no wrapper', () => {
	const inputs = [
		{ offset: '0%', 'stop-color': '#1d4ed8', 'stop-opacity': 0.5 },
		{ offset: 0.25, 'stop-color': 'currentColor' }
	];
	const cases = inputs.map((input) => ({
		name: `a stop given ${JSON.stringify(input)}`,
		input,
		output: { body: markup(input) }
	}));
	recordExampleCases(where('renders-a-stop-with-its-attributes-and-no-wrapper'), cases);
	expect(cases[0].output.body).toBe(
		'<stop offset="0%" stop-color="#1d4ed8" stop-opacity="0.5"></stop>'
	);
	expect(cases[1].output.body).toBe('<stop offset="0.25" stop-color="currentColor"></stop>');
	expect(cases[0].output.body).not.toMatch(/<(g|svg|div|span)\b/);
});

test('Renders the children snippet as the only content', () => {
	const title = createRawSnippet(() => ({ render: () => '<title>Halfway</title>' }));
	const input = { offset: '50%', 'stop-color': '#16a34a' };
	const body = markup(input, title);
	recordExampleCases(where('renders-the-children-snippet-as-the-only-content'), [
		{
			name: 'a stop given offset, colour and a title snippet',
			input: { ...input, children: 'snippet rendering <title>Halfway</title>' },
			output: { body }
		}
	]);
	expect(body).toBe('<stop offset="50%" stop-color="#16a34a"><title>Halfway</title></stop>');
	expect(body).not.toContain('children');
});

test('Renders an empty stop when no children are given', () => {
	const input = { offset: '100%' };
	const body = markup(input);
	recordExampleCases(where('renders-an-empty-stop-when-no-children-are-given'), [
		{ name: 'a stop given only an offset', input, output: { body } }
	]);
	expect(body).toBe('<stop offset="100%"></stop>');
});
