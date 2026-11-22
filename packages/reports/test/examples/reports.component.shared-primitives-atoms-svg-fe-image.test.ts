import { render } from 'svelte/server';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { test } from 'vitest';
import SvgFeImage from '../../src/components/shared-primitives/atoms/SvgFeImage.svelte';

test('renders a native feImage with its SVG attributes', () => {
	const props = { href: '/fixtures/texture.png', x: 2, y: 3, width: 24, height: 18 };
	const rendered = render(SvgFeImage, { props }).body.trim();
	const body = rendered.replace(/<!--[\s\S]*?-->/g, '').trim();

	expect(body).toMatch(/^<feImage\b/);
	expect(body).toContain('href="/fixtures/texture.png"');
	expect(body).toContain('width="24"');
	expect(body).toMatch(/^<feImage\b[^>]*><\/feImage>$/);

	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-svg-fe-image',
			symbol: 'SvgFeImage',
			state: 'renders-a-native-feimage-with-its-svg-attributes',
			evidence: 'examples-cases',
			file: 'renders-a-native-feimage-with-its-svg-attributes.json'
		},
		[{ name: 'renders the image reference and dimensions', input: props, output: { body } }]
	);
});
