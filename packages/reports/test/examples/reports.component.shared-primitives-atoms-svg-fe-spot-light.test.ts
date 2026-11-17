import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgFeSpotLight from '../../src/components/shared-primitives/atoms/SvgFeSpotLight.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real SvgFeSpotLight, rendered on the server the way a parent filter renders it: the props
 * become attributes of the native feSpotLight element, and the component adds no wrapper.
 */
const where = (state: string) => ({
	unitId: 'reports.component.shared-primitives-atoms-svg-fe-spot-light',
	symbol: 'SvgFeSpotLight',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

const lightContent = createRawSnippet(() => ({
	render: () => '<desc>spot</desc>'
}));

/** The markup of the render without Svelte's hydration comments, which carry no meaning here. */
const markupOf = (body: string) => body.replace(/<!--.*?-->/g, '');

test('fespotlight renders its attributes and no wrapper', () => {
	const props = { x: 10, y: 20, z: 30, pointsAtX: 0, pointsAtY: 0, pointsAtZ: 0, specularExponent: 1 };
	const body = markupOf(render(SvgFeSpotLight, { props }).body);
	recordExampleCases(where('fespotlight-renders-its-attributes-and-no-wrapper'), [
		{
			name: 'a spot light above the origin pointing down at the filter region',
			input: props,
			output: { body }
		}
	]);
	expect(body).toMatch(/^<feSpotLight\b/);
	expect(body).not.toContain('<svg');
	expect(body).toBe(
		'<feSpotLight x="10" y="20" z="30" pointsAtX="0" pointsAtY="0" pointsAtZ="0" specularExponent="1"></feSpotLight>'
	);
});

test('the children snippet renders as the element content', () => {
	const props = { x: 5, y: 6, z: 7, children: lightContent };
	const body = markupOf(render(SvgFeSpotLight, { props }).body);
	recordExampleCases(where('the-children-snippet-renders-as-the-element-content'), [
		{
			name: 'a spot light that carries a desc child',
			input: { x: props.x, y: props.y, z: props.z, children: 'snippet rendering <desc>spot' },
			output: { body }
		}
	]);
	expect(body).toMatch(/^<feSpotLight\b/);
	expect(body).not.toContain('children');
	expect(body).toBe('<feSpotLight x="5" y="6" z="7"><desc>spot</desc></feSpotLight>');
});
