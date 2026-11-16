import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { SimulatorPage } from '../../scripts/ios-acceptance-page';

test('resets a page with no active inspector', async () => {
	const page = new SimulatorPage({
		socketPath: '/tmp/ios-simulator-webkit.sock',
		runtime: '18.5'
	});

	await expect(page.reset()).resolves.toBeUndefined();
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-page',
			symbol: 'SimulatorPage.reset',
			state: 'resets-a-page-with-no-active-inspector',
			evidence: 'examples-cases',
			file: 'resets-a-page-with-no-active-inspector.json'
		},
		[
			{
				name: 'reset a new page before connecting to a simulator',
				input: { socketPath: '/tmp/ios-simulator-webkit.sock', runtime: '18.5' },
				output: null
			}
		]
	);
});
