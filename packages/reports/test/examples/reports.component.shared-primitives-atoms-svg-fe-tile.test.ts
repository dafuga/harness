import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import SvgFeTile from '../../src/components/shared-primitives/atoms/SvgFeTile.svelte';

/** The evidence of one state: its cases, under the unit and the component that shows them. */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-fe-tile',
	symbol: 'SvgFeTile',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/**
 * The markup a server render writes for the component. Svelte also writes hydration comments that
 * mark its blocks; they are not markup the component produces, so they are removed.
 */
const markup = (body: string): string => body.replace(/<!--[^>]*?-->/g, '').trim();

const geometry = {
	in: 'SourceGraphic',
	x: '0',
	y: '0',
	width: '100%',
	height: '100%',
	result: 'tile'
};

test('attributes are written onto a native feTile with no wrapper', () => {
	const state = 'attributes-are-written-onto-a-native-fetile-with-no-wrapper';
	const body = markup(render(SvgFeTile, { props: geometry }).body);
	const undefinedChildren = markup(
		render(SvgFeTile, { props: { ...geometry, children: undefined } }).body
	);
	expect(body).toBe(
		'<feTile in="SourceGraphic" x="0" y="0" width="100%" height="100%" result="tile"></feTile>'
	);
	expect(undefinedChildren).toBe(body);
	recordExampleCases(where(state), [
		{
			name: 'a tile with its geometry and result name, children omitted',
			input: geometry,
			output: { body }
		},
		{
			name: 'the same tile with children passed as undefined',
			input: { ...geometry, children: 'undefined' },
			output: { body: undefinedChildren }
		}
	]);
});

test('a children snippet renders inside the feTile element', () => {
	const state = 'a-children-snippet-renders-inside-the-fetile-element';
	const children = createRawSnippet(() => ({
		render: () => '<desc>Tiles the source graphic across the region</desc>'
	}));
	const body = markup(
		render(SvgFeTile, { props: { in: 'SourceGraphic', width: '100%', children } }).body
	);
	expect(body).toBe(
		'<feTile in="SourceGraphic" width="100%"><desc>Tiles the source graphic across the region</desc></feTile>'
	);
	expect(body).not.toContain('children=');
	recordExampleCases(where(state), [
		{
			name: 'a source tile whose content is a desc element',
			input: {
				in: 'SourceGraphic',
				width: '100%',
				children: 'snippet rendering <desc>Tiles the source graphic across the region</desc>'
			},
			output: { body }
		}
	]);
});
