import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { browserTestingFiles } from '../../src/templates/module-system/browserTestingFiles';

const configPath = 'src/configs/playwright/browserPlaywrightConfig.ts';
const meta = {
	unitId: 'template.module-system-browser-testing-files',
	symbol: 'browserTestingFiles',
	evidence: 'examples-cases'
};

function planned(path: string): string {
	return browserTestingFiles.find((file) => file.path === path)?.contents ?? '';
}

function linesMatching(contents: string, pattern: RegExp): string[] {
	return contents.split('\n').filter((line) => pattern.test(line));
}

test('Plans the dedicated headless Playwright config', () => {
	const paths = browserTestingFiles.map((file) => file.path);
	const config = planned(configPath);
	const configLines = linesMatching(config, /testDir|outputDir|headless|workers|reporter/);

	expect(paths).toEqual([
		'tests/e2e/plugin-support/browserTest.ts',
		'tests/e2e/plugin-support/browserTest.types.ts',
		configPath
	]);
	expect(config).toContain("testDir: '../../../tests/e2e/browser'");
	expect(config).toContain("outputDir: '../../../test-results/browser'");
	expect(config).toContain("browserName: 'chromium'");
	expect(config).toContain("screenshot: 'only-on-failure'");
	expect(config).toContain('workers: Number(env.HARNESS_RESOURCE_CPUS ?? 1)');
	expect(config).toContain("reporter: 'list'");
	recordExampleCases(
		{
			...meta,
			state: 'plans-the-dedicated-headless-playwright-config',
			file: 'plans-the-dedicated-headless-playwright-config.json'
		},
		[
			{
				name: 'two browser support files then the dedicated config',
				input: {},
				output: { paths, configLines }
			}
		]
	);
});

test('Rewrites support files into the plugin-support folder', () => {
	const paths = browserTestingFiles.map((file) => file.path);

	expect(paths.some((path) => path.includes('tests/e2e/support'))).toBe(false);
	expect(paths.filter((path) => path.startsWith('tests/e2e/plugin-support/'))).toHaveLength(2);
	expect(paths).toContain(configPath);
	expect(configPath).not.toBe('playwright.config.ts');
	recordExampleCases(
		{
			...meta,
			state: 'rewrites-support-files-into-the-plugin-support-folder',
			file: 'rewrites-support-files-into-the-plugin-support-folder.json'
		},
		[
			{
				name: 'support paths are rewritten, not copied; config stays separate',
				input: {},
				output: { paths }
			}
		]
	);
});
