import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import pickerPlaywrightConfig from '../../src/configs/development-tooling/pickerPlaywrightConfig';

const state = 'resolves-provider-picker-playwright-settings';

test('Resolves provider picker Playwright settings', () => {
	expect(pickerPlaywrightConfig).toMatchObject({
		testDir: '../../tests/e2e',
		testMatch: 'provider-picker.spec.ts',
		workers: 1,
		reporter: 'list',
		use: { viewport: { width: 900, height: 900 } }
	});
	const output = {
		testDir: pickerPlaywrightConfig.testDir,
		testMatch: pickerPlaywrightConfig.testMatch,
		workers: pickerPlaywrightConfig.workers,
		reporter: pickerPlaywrightConfig.reporter,
		use: pickerPlaywrightConfig.use,
		webServer: pickerPlaywrightConfig.webServer
	};
	recordExampleCases(
		{
			unitId: 'reports.config.picker-playwright',
			symbol: 'pickerPlaywrightConfig',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name: 'default provider picker suite settings', input: null, output }]
	);
});
