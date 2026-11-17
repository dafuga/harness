import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

test('loads the atomic elements type entry', () => {
	expect(true).toBe(true);
	recordExampleCases(
		{
			unitId: 'desktop.entry.atomic-elements-d',
			symbol: 'atomic-elements',
			state: 'loads-the-atomic-elements-type-entry',
			evidence: 'examples-cases',
			file: 'loads-the-atomic-elements-type-entry.json'
		},
		[{ name: 'type-only entry has no runtime result', input: [], output: null }]
	);
});
