import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { SimulatorPage } from '../../scripts/ios-acceptance-page';
import { SimulatorPageError } from '../../scripts/ios-acceptance-page.types';

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

test('Throws SimulatorPageError when wanted text misses its deadline', async () => {
	const page = new SimulatorPage({
		socketPath: '/tmp/ios-simulator-webkit.sock',
		runtime: '18.5'
	});
	const input = { expression: 'return document.title;', wanted: 'Checkout', seconds: 0 };
	await expect(page.until(input.expression, input.wanted, input.seconds)).rejects.toBeInstanceOf(
		SimulatorPageError
	);
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-page',
			symbol: 'SimulatorPage.until',
			state: 'throws-simulatorpageerror-when-wanted-text-misses-its-deadli',
			evidence: 'examples-cases',
			file: 'throws-simulatorpageerror-when-wanted-text-misses-its-deadli.json'
		},
		[
			{
				name: 'wanted text is absent when the zero second deadline is checked',
				input,
				error: { name: 'SimulatorPageError', message: '"Checkout" did not appear within 0 s; last seen: ' }
			}
		]
	);
});
