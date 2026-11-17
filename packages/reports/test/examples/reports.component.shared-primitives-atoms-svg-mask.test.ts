import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgMask from '../../src/components/shared-primitives/atoms/SvgMask.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgMask component, rendered on the server the way the reports app renders it: its
 * props become attributes of one native mask element, with no wrapper around it. Only the
 * markup is inspected, so no browser, server or port is involved.
 */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-mask',
	symbol: 'SvgMask',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/**
 * The markup of one render: the hydration comments Svelte's server wraps around every render are
 * dropped, so what remains is the mask element alone.
 */
const markup = (body: string) => body.replace(/<!--[\s\S]*?-->/g, '').trim();

test('renders a bare mask element carrying its attributes', () => {
	const props = {
		id: 'fade',
		maskUnits: 'userSpaceOnUse',
		x: '0',
		y: '0',
		width: '24',
		height: '24'
	};
	const body = markup(render(SvgMask, { props }).body);
	recordExampleCases(where('renders-a-bare-mask-element-carrying-its-attributes'), [
		{
			name: 'a mask with an id, units and a 24 by 24 box and no children',
			input: props,
			output: { body }
		}
	]);
	expect(body).toMatch(/^<mask\b[^>]*>/);
	expect(body).toMatch(/<mask\b[^>]*id="fade"/);
	expect(body).toMatch(/<mask\b[^>]*maskUnits="userSpaceOnUse"/);
	expect(body).toMatch(/<mask\b[^>]*width="24"/);
	expect(body).toMatch(/<mask\b[^>]*height="24"/);
	expect(body).toMatch(/<\/mask>$/);
	expect(body.match(/<mask\b/g)).toHaveLength(1);
});

test('renders the children snippet inside the mask', () => {
	const rect = createRawSnippet(() => ({
		render: () => '<rect x="0" y="0" width="24" height="24" fill="white"></rect>'
	}));
	const props = { id: 'fade', children: rect };
	const body = markup(render(SvgMask, { props }).body);
	recordExampleCases(where('renders-the-children-snippet-inside-the-mask'), [
		{
			name: 'a mask with id fade whose children snippet draws one white rectangle',
			input: { id: 'fade', children: '<rect> snippet' },
			output: { body }
		}
	]);
	expect(body).toMatch(/^<mask\b[^>]*id="fade"[^>]*>/);
	expect(body).toContain('<rect x="0" y="0" width="24" height="24" fill="white"></rect>');
	expect(body).toMatch(/<\/mask>$/);
	expect(body).not.toMatch(/children=/);
});

test('renders an empty mask when children are omitted', () => {
	const body = markup(render(SvgMask, { props: { id: 'empty' } }).body);
	recordExampleCases(where('renders-an-empty-mask-when-children-are-omitted'), [
		{
			name: 'a mask with only an id and no children snippet',
			input: { id: 'empty' },
			output: { body }
		}
	]);
	expect(body).toMatch(/<mask\b[^>]*id="empty"[^>]*>/);
	expect(body).toMatch(/<\/mask>$/);
	expect(body).not.toMatch(/<rect\b/);
	expect(body).not.toMatch(/children=/);
});
