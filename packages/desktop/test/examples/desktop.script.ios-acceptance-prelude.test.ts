import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { pagePrelude } from '../../scripts/ios-acceptance-prelude';

test('provides page helpers for native acceptance expressions', () => {
	const helpers = ['text', 'panel', 'footer', 'field', 'fill', 'named', 'press', 'pressLink'];
	const output = {
		includes: helpers.map((helper) => ({ helper, present: pagePrelude.includes(`const ${helper} =`) })),
		length: pagePrelude.length
	};

	expect(output.includes.every(({ present }) => present)).toBe(true);
	expect(pagePrelude).toContain("text('[aria-label=\"Computer connection\"]')");

	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-prelude',
			symbol: 'pagePrelude',
			state: 'provides-page-helpers-for-native-acceptance-expressions',
			evidence: 'examples-cases',
			file: 'provides-page-helpers-for-native-acceptance-expressions.json'
		},
		[
			{
				name: 'declare the page DOM helpers used by native acceptance expressions',
				input: {},
				output
			}
		]
	);
});
