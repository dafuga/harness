import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgFeConvolveMatrix from '../../src/components/shared-primitives/atoms/SvgFeConvolveMatrix.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/** The evidence of one state: its cases, under the unit and the component they show. */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-fe-convolve-matrix',
	symbol: 'SvgFeConvolveMatrix',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/** The markup with Svelte's server hydration comments removed and the edges trimmed. */
const markup = (body: string) => body.replace(/<!--[^]*?-->/g, '').trim();

/** A sharpen kernel as made-up example attributes, the way a filter definition supplies them. */
const sharpen = {
	kernelMatrix: '0 -1 0 -1 5 -1 0 -1 0',
	order: 3,
	divisor: 1,
	edgeMode: 'duplicate',
	in: 'SourceGraphic',
	result: 'sharpened'
};

test('forwards every prop onto a bare feConvolveMatrix', () => {
	const props = { ...sharpen, id: 'sharpen' };
	const body = markup(render(SvgFeConvolveMatrix, { props }).body);
	recordExampleCases(where('forwards-every-prop-onto-a-bare-feconvolvematrix'), [
		{
			name: 'a kernel, order, divisor, edge mode, input, result and id are all passed',
			input: props,
			output: { body }
		}
	]);
	expect(body).toMatch(/^<feConvolveMatrix [^>]*>/);
	expect(body).toMatch(/ kernelMatrix="0 -1 0 -1 5 -1 0 -1 0"/);
	expect(body).toMatch(/ order="3"/);
	expect(body).toMatch(/ edgeMode="duplicate"/);
	expect(body).toMatch(/ in="SourceGraphic"/);
	expect(body).toMatch(/ id="sharpen"/);
	expect(body.endsWith('</feConvolveMatrix>')).toBe(true);
	// No wrapper: the only closing tag is the element's own.
	expect(body.match(/<\//g)).toHaveLength(1);
});

test('renders children inside the element when given', () => {
	const children = createRawSnippet(() => ({ render: () => '<desc>sharpen</desc>' }));
	const props = { ...sharpen, children };
	const body = markup(render(SvgFeConvolveMatrix, { props }).body);
	recordExampleCases(where('renders-children-inside-the-element-when-given'), [
		{
			name: 'a snippet rendering a desc element is placed inside the kernel element',
			input: { ...sharpen, children: 'snippet rendering <desc>sharpen</desc>' },
			output: { body }
		}
	]);
	expect(body).toMatch(/^<feConvolveMatrix [^>]*><desc>sharpen<\/desc><\/feConvolveMatrix>$/);
});

test('leaves the element empty when children is omitted', () => {
	const omitted = markup(render(SvgFeConvolveMatrix, { props: { ...sharpen } }).body);
	const undefinedChildren = markup(
		render(SvgFeConvolveMatrix, { props: { ...sharpen, children: undefined } }).body
	);
	recordExampleCases(where('leaves-the-element-empty-when-children-is-omitted'), [
		{
			name: 'children left out of the props',
			input: { ...sharpen },
			output: { body: omitted }
		},
		{
			name: 'children passed as undefined',
			input: { ...sharpen, children: undefined },
			output: { body: undefinedChildren }
		}
	]);
	expect(omitted).toMatch(/^<feConvolveMatrix [^>]*><\/feConvolveMatrix>$/);
	expect(undefinedChildren).toBe(omitted);
});
