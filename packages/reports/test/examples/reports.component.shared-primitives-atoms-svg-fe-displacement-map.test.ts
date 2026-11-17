import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgFeDisplacementMap from '../../src/components/shared-primitives/atoms/SvgFeDisplacementMap.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgFeDisplacementMap rendered on the server, the way a parent SVG filter renders it:
 * props become attributes on the native feDisplacementMap element, and a supplied child snippet
 * is rendered inside that element. No wrapper element appears in either case.
 */

/**
 * The markup that matters: the feDisplacementMap element itself. Svelte's server output wraps it in
 * hydration comments, which are not part of the element and are dropped here.
 */
const element = (body: string): string => {
	const match = body.match(/<feDisplacementMap[\s\S]*<\/feDisplacementMap>/);
	if (!match) throw new Error('no feDisplacementMap element in the markup');
	return match[0];
};

/** The evidence of one state: its cases, under the unit and the component they show. */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-fe-displacement-map',
	symbol: 'SvgFeDisplacementMap',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

test('Renders the native element with its attributes', () => {
	const props = {
		in: 'SourceGraphic',
		in2: 'noise',
		scale: '12',
		xChannelSelector: 'R',
		yChannelSelector: 'G'
	};
	const body = element(render(SvgFeDisplacementMap, { props }).body);
	recordExampleCases(where('renders-the-native-element-with-its-attributes'), [
		{
			name: 'a filter passes a source, a noise map, a scale and two channel selectors',
			input: props,
			output: { body }
		}
	]);
	expect(body).toMatch(/^<feDisplacementMap[^>]*>/);
	expect(body).toMatch(/ in="SourceGraphic"/);
	expect(body).toMatch(/ in2="noise"/);
	expect(body).toMatch(/ scale="12"/);
	expect(body).toMatch(/ xChannelSelector="R"/);
	expect(body).toMatch(/ yChannelSelector="G"/);
	expect(body).not.toContain('children');
	expect(body).not.toMatch(/<g[\s>]|<svg[\s>]|<div[\s>]/);
});

test('Renders a supplied child snippet inside the element', () => {
	const children = createRawSnippet(() => ({
		render: () => '<desc>Warp the source with noise</desc>'
	}));
	const props = { in: 'SourceGraphic', in2: 'noise', scale: '4', children };
	const body = element(render(SvgFeDisplacementMap, { props }).body);
	recordExampleCases(where('renders-a-supplied-child-snippet-inside-the-element'), [
		{
			name: 'a filter supplies a desc child snippet to the displacement map',
			input: { in: 'SourceGraphic', in2: 'noise', scale: '4', children: 'desc snippet' },
			output: { body }
		}
	]);
	expect(body).toMatch(
		/^<feDisplacementMap[^>]*>.*<desc>Warp the source with noise<\/desc>.*<\/feDisplacementMap>$/s
	);
	expect(body).toContain('<desc>Warp the source with noise</desc>');
	expect(body.match(/<feDisplacementMap[\s>]/g)).toHaveLength(1);
	expect(body).not.toMatch(/<g[\s>]|<svg[\s>]|<div[\s>]/);
});
