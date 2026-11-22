import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgFeGaussianBlur from '../../src/components/shared-primitives/atoms/SvgFeGaussianBlur.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/** Svelte's server output wraps the element in hydration comments; only the element's markup matters here. */
const markup = (body: string): string => body.replace(/<!--.*?-->/g, '').trim();

/** The evidence of one state: its cases, under the component and the markup they show. */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-fe-gaussian-blur',
	symbol: 'SvgFeGaussianBlur',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

test('renders the bare element with spread attributes', () => {
	const props = { stdDeviation: '4', in: 'SourceGraphic', result: 'blur' };
	const body = markup(render(SvgFeGaussianBlur, { props }).body);
	recordExampleCases(where('renders-the-bare-element-with-spread-attributes'), [
		{
			name: 'a blur of SourceGraphic with stdDeviation 4 and a result name',
			input: props,
			output: { body }
		}
	]);
	expect(body).toMatch(/^<feGaussianBlur[^>]*>/);
	expect(body).toContain('stdDeviation="4"');
	expect(body).toContain('in="SourceGraphic"');
	expect(body).toContain('result="blur"');
	expect(body).toMatch(/<\/feGaussianBlur>$/);
	expect(body).not.toMatch(/<(div|g|svg|span)\b/);
});

test('renders the children snippet inside the element', () => {
	const children = createRawSnippet(() => ({
		render: () => '<title>Soft shadow blur</title>'
	}));
	const body = markup(
		render(SvgFeGaussianBlur, {
			props: { children, stdDeviation: '2' }
		}).body
	);
	recordExampleCases(where('renders-the-children-snippet-inside-the-element'), [
		{
			name: 'a snippet providing a title is rendered as the blur content',
			input: { stdDeviation: '2', children: 'raw snippet: <title>Soft shadow blur</title>' },
			output: { body }
		}
	]);
	expect(body).toMatch(/^<feGaussianBlur[^>]*stdDeviation="2"[^>]*>/);
	expect(body).toContain('<title>Soft shadow blur</title>');
	expect(body.indexOf('<title>')).toBeGreaterThan(body.indexOf('<feGaussianBlur'));
	expect(body).toMatch(/<\/feGaussianBlur>$/);
});

test('omits the wrapper and content when children are omitted', () => {
	const body = markup(render(SvgFeGaussianBlur, { props: {} }).body);
	recordExampleCases(where('omits-the-wrapper-and-content-when-children-are-omitted'), [
		{
			name: 'no props at all renders an empty feGaussianBlur element',
			input: {},
			output: { body }
		}
	]);
	expect(body).toMatch(/^<feGaussianBlur[^>]*><\/feGaussianBlur>$/);
	expect(body).not.toContain('<title');
});
