import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgAnimateMotion from '../../src/components/shared-primitives/atoms/SvgAnimateMotion.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgAnimateMotion, rendered on the server the way a parent SVG renders it: the props
 * become attributes of the native animateMotion element, and the component adds no wrapper.
 */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-animate-motion',
	symbol: 'SvgAnimateMotion',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

const motionContent = createRawSnippet(() => ({
	render: () => '<mpath href="#route"></mpath>'
}));

/** The markup of the render without Svelte's hydration comments, which carry no meaning here. */
const markupOf = (body: string) => body.replace(/<!--.*?-->/g, '');

test('animateMotion renders its attributes and no wrapper', () => {
	const props = { path: 'M0,0 L100,0', dur: '2s', repeatCount: 'indefinite' };
	const body = markupOf(render(SvgAnimateMotion, { props }).body);
	recordExampleCases(where('animatemotion-renders-its-attributes-and-no-wrapper'), [
		{
			name: 'a motion path with a duration and an indefinite repeat',
			input: props,
			output: { body }
		}
	]);
	expect(body).toMatch(/^<animateMotion\b/);
	expect(body).toBe(
		'<animateMotion path="M0,0 L100,0" dur="2s" repeatCount="indefinite"></animateMotion>'
	);
});

test('the children snippet renders as the element content', () => {
	const props = { path: 'M0,0 L50,50', dur: '1s', children: motionContent };
	const body = markupOf(render(SvgAnimateMotion, { props }).body);
	recordExampleCases(where('the-children-snippet-renders-as-the-element-content'), [
		{
			name: 'a motion path that carries an mpath child',
			input: {
				path: props.path,
				dur: props.dur,
				children: 'snippet rendering <mpath href="#route">'
			},
			output: { body }
		}
	]);
	expect(body).toMatch(/^<animateMotion\b/);
	expect(body).not.toContain('children');
	expect(body).toBe(
		'<animateMotion path="M0,0 L50,50" dur="1s"><mpath href="#route"></mpath></animateMotion>'
	);
});
