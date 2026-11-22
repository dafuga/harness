import { render } from 'svelte/server';
import { test } from 'vitest';
import SvgFeSpecularLighting from '../../src/components/shared-primitives/atoms/SvgFeSpecularLighting.svelte';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

const unitId = 'reports.component.shared-primitives-atoms-svg-fe-specular-lighting';
const state = 'renders-the-native-element-with-attributes-and-no-content-wh';

test('renders the native element with attributes and no content when children are omitted', () => {
	const cases = [
		{
			name: 'a surface scale and lighting color are forwarded',
			props: { surfaceScale: 2, lightingColor: '#ffffff' }
		},
		{
			name: 'a specular constant and result name are forwarded',
			props: { specularConstant: 0.75, result: 'highlight' }
		}
	].map(({ name, props }) => {
		const body = render(SvgFeSpecularLighting, { props }).body.trim();
		return { name, input: props, output: { body } };
	});

	for (const { output } of cases) {
		expect(output.body).toContain('<feSpecularLighting ');
		expect(output.body).toContain('</feSpecularLighting>');
		expect(output.body).not.toContain('>children<');
	}
	expect(cases[0].output.body).toContain('surfaceScale="2"');
	expect(cases[0].output.body).toContain('lightingColor="#ffffff"');
	expect(cases[1].output.body).toContain('specularConstant="0.75"');
	expect(cases[1].output.body).toContain('result="highlight"');

	recordExampleCases(
		{
			unitId,
			symbol: 'SvgFeSpecularLighting',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
});
