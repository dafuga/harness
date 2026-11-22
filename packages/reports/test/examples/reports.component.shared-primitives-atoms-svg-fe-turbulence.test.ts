import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgFeTurbulence from '../../src/components/shared-primitives/atoms/SvgFeTurbulence.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

const where = {
	unitId: 'reports.component.shared-primitives-atoms-svg-fe-turbulence',
	symbol: 'SvgFeTurbulence',
	state: 'forwards-attributes-and-optional-children-to-the-svg-element',
	evidence: 'examples-cases',
	file: 'forwards-attributes-and-optional-children-to-the-svg-element.json'
} as const;

test('forwards attributes and optional children to the SVG element', () => {
	const child = createRawSnippet(() => ({ render: () => '<fePointLight x="2" y="3" z="4" />' }));
	const withoutChildren = render(SvgFeTurbulence, {
		props: { 'baseFrequency': '0.04 0.08', numOctaves: 2, seed: 7 } as never
	}).body.trim();
	const withChildren = render(SvgFeTurbulence, {
		props: { 'baseFrequency': '0.1', children: child, 'data-source': 'fixture' } as never
	}).body.trim();

	// Svelte's server renderer adds snippet boundary comments around component output.
	expect(withoutChildren).toMatch(/<feTurbulence\b/);
	expect(withoutChildren).toContain('baseFrequency="0.04 0.08"');
	expect(withoutChildren).toContain('numOctaves="2"');
	expect(withoutChildren).toContain('seed="7"');
	expect(withoutChildren).not.toContain('<div');
	expect(withChildren).toContain('<feTurbulence');
	expect(withChildren).toContain('data-source="fixture"');
	expect(withChildren).toContain('<fePointLight x="2" y="3" z="4"');
	recordExampleCases(where, [
		{
			name: 'forwards caller attributes without children',
			input: { baseFrequency: '0.04 0.08', numOctaves: 2, seed: 7 },
			output: { body: withoutChildren }
		},
		{
			name: 'renders optional child markup inside the element',
			input: { baseFrequency: '0.1', child: '<fePointLight x="2" y="3" z="4" />', 'data-source': 'fixture' },
			output: { body: withChildren }
		}
	]);
});
