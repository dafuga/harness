import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { SvelteHTMLElements } from 'svelte/elements';
import type {} from '../../src/lib/atoms/native-elements';

test('Accepts native and SVG element attributes', () => {
	const button: SvelteHTMLElements['hx-button'] = {
		type: 'submit',
		disabled: true
	};
	const path: SvelteHTMLElements['hx-svg-path'] = {
		d: 'M0 0 L10 10',
		fill: 'currentColor'
	};
	expect(button.disabled).toBe(true);
	expect(path.d).toBe('M0 0 L10 10');
	recordExampleCases(
		{
			unitId: 'reports.entry.atomic-elements-d',
			symbol: 'SvelteHTMLElements',
			state: 'accepts-native-and-svg-element-attributes',
			evidence: 'examples-cases',
			file: 'accepts-native-and-svg-element-attributes.json'
		},
		[
			{
				name: 'native button attributes',
				input: { element: 'hx-button', type: 'submit', disabled: true },
				output: { type: button.type, disabled: button.disabled }
			},
			{
				name: 'SVG path attributes',
				input: { element: 'hx-svg-path', d: 'M0 0 L10 10', fill: 'currentColor' },
				output: { d: path.d, fill: path.fill }
			}
		]
	);
});
