import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgFilter from '../../src/components/shared-primitives/atoms/SvgFilter.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgFilter, rendered on the server the way a parent svg renders it: props in, markup out.
 * The server render adds hydration comments around the children; they carry no meaning here, so
 * the recorded body leaves them out.
 */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-filter',
	symbol: 'SvgFilter',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

const withoutComments = (body: string): string => body.replace(/<!--[\s\S]*?-->/g, '').trim();

const blur = createRawSnippet(() => ({
	render: () => '<feGaussianBlur stdDeviation="2"/>'
}));

test('Renders a native filter element forwarding its attributes', () => {
	const props = { id: 'soft-shadow', x: '-10%', y: '-10%', width: '120%', height: '120%' };
	const body = withoutComments(render(SvgFilter, { props }).body);
	recordExampleCases(where('renders-a-native-filter-element-forwarding-its-attributes'), [
		{
			name: 'a filter with an id and region is rendered with no children',
			input: props,
			output: { body }
		}
	]);
	expect(body).toMatch(/^<filter\b[^>]*>/);
	expect(body).toMatch(/<filter\b[^>]*\bid="soft-shadow"/);
	expect(body).toMatch(/<filter\b[^>]*\bx="-10%"/);
	expect(body).toMatch(/<filter\b[^>]*\bwidth="120%"/);
	expect(body.endsWith('</filter>')).toBe(true);
	expect(body.match(/<filter\b/g)).toHaveLength(1);
});

test('Renders truthy child markup inside the filter', () => {
	const body = withoutComments(render(SvgFilter, { props: { children: blur } }).body);
	recordExampleCases(where('renders-truthy-child-markup-inside-the-filter'), [
		{
			name: 'a filter given a child snippet renders that markup inside itself',
			input: { children: '<feGaussianBlur stdDeviation="2"/>' },
			output: { body }
		}
	]);
	expect(body).toMatch(/^<filter\b[^>]*>.*<\/filter>$/s);
	expect(body).toMatch(/<filter\b[^>]*>\s*<feGaussianBlur stdDeviation="2"\/>\s*<\/filter>/);
	expect(body).not.toMatch(/<svg\b/);
});

test('Renders an empty filter when children are omitted', () => {
	const body = withoutComments(render(SvgFilter, { props: { id: 'empty' } }).body);
	recordExampleCases(where('renders-an-empty-filter-when-children-are-omitted'), [
		{
			name: 'a filter with no children prop renders an empty element',
			input: { id: 'empty' },
			output: { body }
		}
	]);
	expect(body).toMatch(/^<filter\b[^>]*\bid="empty"[^>]*><\/filter>$/);
	expect(body).not.toContain('feGaussianBlur');
});
