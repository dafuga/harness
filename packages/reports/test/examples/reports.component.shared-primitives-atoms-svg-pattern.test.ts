import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgPattern from '../../src/components/shared-primitives/atoms/SvgPattern.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgPattern component, rendered on the server the way its callers render it: with props
 * and an optional snippet, and no browser or port involved. Server output carries Svelte's
 * hydration comments, which are removed so the markup shows only the native pattern element.
 */
const markup = (body: string) => body.replace(/<!--.*?-->/g, '').trim();

/** The evidence of one state: its cases, under the unit and the component they show. */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-pattern',
	symbol: 'SvgPattern',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

test('Renders a native pattern with forwarded attributes only', () => {
	const props = { id: 'grid', width: 8, height: 8, patternUnits: 'userSpaceOnUse' };
	const body = markup(render(SvgPattern, { props }).body);
	recordExampleCases(where('renders-a-native-pattern-with-forwarded-attributes-only'), [
		{
			name: 'a pattern named grid with an 8 by 8 tile and no child content',
			input: props,
			output: { body }
		}
	]);
	expect(body).toBe(
		'<pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse"></pattern>'
	);
	expect(body.match(/<pattern[\s>]/g)).toHaveLength(1);
});

test('Renders a supplied snippet inside the pattern element', () => {
	const props = { id: 'dots', width: 4, height: 4 };
	const tile = '<rect width="2" height="2" fill="currentColor"/>';
	const children = createRawSnippet(() => ({ render: () => tile }));
	const body = markup(render(SvgPattern, { props: { ...props, children } }).body);
	recordExampleCases(where('renders-a-supplied-snippet-inside-the-pattern-element'), [
		{
			name: 'a 4 by 4 pattern named dots holding one 2 by 2 rectangle',
			input: { props, children: tile },
			output: { body }
		}
	]);
	expect(body).toMatch(/^<pattern id="dots" width="4" height="4">/);
	expect(body).toContain(tile);
	expect(body).toMatch(/<\/pattern>$/);
	expect(body.indexOf(tile)).toBeGreaterThan(body.indexOf('<pattern'));
});
