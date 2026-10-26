import { browserTestFiles } from '../development-tooling/browserTest';

/** Dedicated config preserves the application's existing Playwright settings. */
export const browserTestingFiles = [
	...browserTestFiles().map((file) => ({
		...file,
		path: file.path.replace('tests/e2e/support', 'tests/plugin-support')
	})),
	{
		path: 'src/configs/playwright/browserPlaywrightConfig.ts',
		contents: `import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: '../../../tests/browser',
 outputDir: '../../../test-results/browser',
 use: { headless: true, browserName: 'chromium', screenshot: 'only-on-failure' },
 workers: Number(process.env.HARNESS_RESOURCE_CPUS ?? 1),
 reporter: 'list'
});
`
	}
];
