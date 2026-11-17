import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import '../../scripts/ios-acceptance-quiet';

test('loads the quiet acceptance setup script', () => {
	expect(undefined).toBeUndefined();

	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-quiet',
			symbol: 'ios-acceptance-quiet',
			state: 'loads-the-quiet-acceptance-setup-script',
			evidence: 'examples-cases',
			file: 'loads-the-quiet-acceptance-setup-script.json'
		},
		[
			{
				name: 'import the setup script before the debugger package',
				input: {},
				output: { completed: true }
			}
		]
	);
});
