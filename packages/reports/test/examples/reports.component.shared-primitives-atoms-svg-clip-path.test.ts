import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import SvgClipPath from '../../src/components/shared-primitives/atoms/SvgClipPath.svelte';

/** Drops the hydration comments the server renderer adds around the markup. */
function markup(body: string): string {
	return body.replace(/<!--[^>]*-->/g, '').trim();
}

const rect = createRawSnippet(() => ({
	render: () => '<rect x="0" y="0" width="10" height="10" />'
}));

test('Renders the clip path with its attributes and no wrapper', () => {
	const first = markup(
		render(SvgClipPath, { props: { id: 'frame-clip', clipPathUnits: 'userSpaceOnUse' } }).body
	);
	const second = markup(render(SvgClipPath, { props: { id: 'card-clip' } }).body);
	expect(first).toBe('<clipPath id="frame-clip" clipPathUnits="userSpaceOnUse"></clipPath>');
	expect(second).toBe('<clipPath id="card-clip"></clipPath>');
	expect(first.startsWith('<clipPath')).toBe(true);
	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-svg-clip-path',
			symbol: 'SvgClipPath',
			state: 'renders-the-clip-path-with-its-attributes-and-no-wrapper',
			evidence: 'examples-cases',
			file: 'renders-the-clip-path-with-its-attributes-and-no-wrapper.json'
		},
		[
			{
				name: 'id and clipPathUnits are spread onto the native clipPath',
				input: { id: 'frame-clip', clipPathUnits: 'userSpaceOnUse' },
				output: { body: first }
			},
			{
				name: 'only an id is spread onto the native clipPath',
				input: { id: 'card-clip' },
				output: { body: second }
			}
		]
	);
});

test('Renders child content inside the clip path', () => {
	const body = markup(render(SvgClipPath, { props: { id: 'tile-clip', children: rect } }).body);
	expect(body).toBe(
		'<clipPath id="tile-clip"><rect x="0" y="0" width="10" height="10" /></clipPath>'
	);
	expect(body).toContain('<rect x="0" y="0" width="10" height="10" />');
	expect(body.endsWith('</clipPath>')).toBe(true);
	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-svg-clip-path',
			symbol: 'SvgClipPath',
			state: 'renders-child-content-inside-the-clip-path',
			evidence: 'examples-cases',
			file: 'renders-child-content-inside-the-clip-path.json'
		},
		[
			{
				name: 'a child snippet is rendered inside the clipPath element',
				input: { id: 'tile-clip', children: 'one 10x10 rect snippet' },
				output: { body }
			}
		]
	);
});

test('Renders an empty clip path when no children are given', () => {
	const body = markup(render(SvgClipPath, { props: { id: 'empty-clip' } }).body);
	expect(body).toBe('<clipPath id="empty-clip"></clipPath>');
	expect(body).not.toContain('<rect');
	expect(body).not.toContain('<g');
	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-svg-clip-path',
			symbol: 'SvgClipPath',
			state: 'renders-an-empty-clip-path-when-no-children-are-given',
			evidence: 'examples-cases',
			file: 'renders-an-empty-clip-path-when-no-children-are-given.json'
		},
		[
			{
				name: 'omitted children render no content inside the clipPath',
				input: { id: 'empty-clip', children: null },
				output: { body }
			}
		]
	);
});
