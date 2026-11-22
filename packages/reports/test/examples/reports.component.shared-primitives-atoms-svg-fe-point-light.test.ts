import { render } from 'svelte/server';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import SvgFePointLight from '../../src/components/shared-primitives/atoms/SvgFePointLight.svelte';
import { test } from 'vitest';

test('renders one native fePointLight without wrapper', () => {
	const props = { x: 12, y: 24, z: 36 };
	const markup = render(SvgFePointLight, { props }).body;
	const body = markup.match(/<fePointLight\b[^>]*>[\s\S]*?<\/fePointLight>/)?.[0] ?? '';
	expect(body).toMatch(/^<fePointLight\b/);
	expect(body).toContain('x="12"');
	expect(body).toContain('y="24"');
	expect(body).toContain('z="36"');
	expect(body).not.toContain('<svg');
	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-svg-fe-point-light',
			symbol: 'SvgFePointLight',
			state: 'renders-one-native-fepointlight-without-wrapper',
			evidence: 'examples-cases',
			file: 'renders-one-native-fepointlight-without-wrapper.json'
		},
		[{ name: 'point light coordinates', input: props, output: { body } }]
	);
});
