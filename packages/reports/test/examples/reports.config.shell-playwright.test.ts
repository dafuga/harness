import { test } from 'vitest';
import { readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import shellPlaywrightConfig from '../../src/configs/development-tooling/shellPlaywrightConfig';

const state = 'resolves-explorer-shell-playwright-settings';
// Playwright resolves testDir and outputDir from the config file's own directory.
const configDirectory = resolve(
	dirname(fileURLToPath(import.meta.url)),
	'../../src/configs/development-tooling'
);
const packageDirectory = resolve(configDirectory, '../../..');
const testDirectory = resolve(configDirectory, String(shellPlaywrightConfig.testDir));
const outputDirectory = resolve(configDirectory, String(shellPlaywrightConfig.outputDir));
const matcher = shellPlaywrightConfig.testMatch as RegExp;
const selected = readdirSync(testDirectory)
	.filter((name) => matcher.test(join(testDirectory, name)))
	.sort();

test('Resolves explorer-shell Playwright settings', () => {
	expect(shellPlaywrightConfig).toMatchObject({
		workers: 1,
		reporter: 'list',
		use: {
			screenshot: 'only-on-failure',
			launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] }
		}
	});
	expect(shellPlaywrightConfig.webServer).toBeUndefined();
	expect(existsSync(testDirectory)).toBe(true);
	expect(selected).toContain('explorer-shell.spec.ts');
	expect(selected.every((name) => /^explorer-shell.*\.spec\.ts$/.test(name))).toBe(true);
	expect(selected.some((name) => name.startsWith('provider-picker'))).toBe(false);
	const output = {
		testDirectory: relative(packageDirectory, testDirectory),
		outputDirectory: relative(packageDirectory, outputDirectory),
		testMatch: String(matcher),
		selected,
		workers: shellPlaywrightConfig.workers,
		reporter: shellPlaywrightConfig.reporter,
		use: shellPlaywrightConfig.use,
		webServer: shellPlaywrightConfig.webServer ?? null
	};
	recordExampleCases(
		{
			unitId: 'reports.config.shell-playwright',
			symbol: 'default',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name: 'default explorer-shell suite settings', input: null, output }]
	);
});
