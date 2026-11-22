import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { test } from 'vitest';
import SvgFeMorphology from '../../src/components/shared-primitives/atoms/SvgFeMorphology.svelte';

const elementBody = (rendered: string) =>
	rendered.match(/<feMorphology\b[\s\S]*?<\/feMorphology>/)?.[0]
		.replace(/<!--[\s\S]*?-->/g, '')
		.trim() ?? '';

test('forwards attributes to feMorphology without children', () => {
	const props = {
		id: 'edge-softening',
		in: 'SourceGraphic',
		operator: 'dilate',
		radius: '1 2',
		'data-filter-step': 'outer-edge'
	};
	const body = elementBody(render(SvgFeMorphology, { props }).body);

	expect(body).toMatch(/^<feMorphology\b/);
	expect(body).toContain('id="edge-softening"');
	expect(body).toContain('in="SourceGraphic"');
	expect(body).toContain('operator="dilate"');
	expect(body).toContain('radius="1 2"');
	expect(body).toContain('data-filter-step="outer-edge"');
	expect(body.match(/<feMorphology\b/g)).toHaveLength(1);
	expect(body).not.toContain('<path');

	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-svg-fe-morphology',
			symbol: 'SvgFeMorphology',
			state: 'forwards-attributes-to-femorphology-without-children',
			evidence: 'examples-cases',
			file: 'forwards-attributes-to-femorphology-without-children.json'
		},
		[{ name: 'forward filter settings without a child snippet', input: props, output: { body } }]
	);
});

test('renders an optional child snippet inside feMorphology', () => {
	const childMarkup = '<title>Softened edge</title>';
	const props = {
		id: 'softened-edge',
		in: 'SourceGraphic',
		operator: 'erode',
		radius: '2',
		children: { markup: childMarkup }
	};
	const children = createRawSnippet(() => ({ render: () => childMarkup }));
	const body = elementBody(render(SvgFeMorphology, {
		props: { ...props, children }
	}).body);

	expect(body).toMatch(/^<feMorphology\b/);
	expect(body).toContain('id="softened-edge"');
	expect(body).toContain('<title>Softened edge</title>');
	expect(body).toMatch(/<\/feMorphology>$/);
	expect(body).not.toContain('<div');

	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-svg-fe-morphology',
			symbol: 'SvgFeMorphology',
			state: 'renders-an-optional-child-snippet-inside-femorphology',
			evidence: 'examples-cases',
			file: 'renders-an-optional-child-snippet-inside-femorphology.json'
		},
		[
			{
				name: 'render the supplied child snippet without a wrapper',
				input: { props },
				output: { body }
			}
		]
	);
});
