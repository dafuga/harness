import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ssr } from '../../src/routes/+layout';

test('Exports ssr as false for the root layout', () => {
	const first = ssr;
	const second = ssr;

	expect(first).toBe(false);
	expect(second).toBe(false);
	recordExampleCases(
		{
			unitId: 'desktop.layout.root',
			symbol: 'ssr',
			state: 'exports-ssr-as-false-for-the-root-layout',
			evidence: 'examples-cases',
			file: 'exports-ssr-as-false-for-the-root-layout.json'
		},
		[
			{ name: 'read the ssr export', input: { export: 'ssr' }, output: first },
			{ name: 'read the ssr export again', input: { export: 'ssr' }, output: second }
		]
	);
});
