import { render } from 'svelte/server';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import SvgMpath from '../../src/components/shared-primitives/atoms/SvgMpath.svelte';
import { test } from 'vitest';

test('renders native mpath with forwarded attributes and no wrapper', () => {
	const props = { href: '#curve', 'data-case': 'path-reference' };
	const body = render(SvgMpath, { props }).body.trim();
	const markup = body.replace(/<!--[\s\S]*?-->/g, '').trim();
	expect(markup).toMatch(/^<mpath\b/);
	expect(body).toContain('href="#curve"');
	expect(body).toContain('data-case="path-reference"');
	expect(markup).toMatch(/<\/mpath>$/);
	expect(markup.match(/<\/?[a-z][^>]*>/gi)).toEqual([
		'<mpath href="#curve" data-case="path-reference">',
		'</mpath>'
	]);
	recordExampleCases(
		{
			unitId: 'reports.component.shared-primitives-atoms-svg-mpath',
			symbol: 'SvgMpath',
			state: 'renders-native-mpath-with-forwarded-attributes-and-no-wrappe',
			evidence: 'examples-cases',
			file: 'renders-native-mpath-with-forwarded-attributes-and-no-wrappe.json'
		},
		[{ name: 'forwards reference attributes', input: props, output: { body } }]
	);
});
