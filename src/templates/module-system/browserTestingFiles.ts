import { browserTestFiles } from '../development-tooling/browserTest';

/** Dedicated config preserves the application's existing Playwright settings. */
export const browserTestingFiles = [
	...browserTestFiles().map((file) => ({
		...file,
		path: file.path.replace('tests/e2e/support', 'tests/e2e/plugin-support')
	})),
	{
		path: 'src/configs/playwright/browserPlaywrightConfig.ts',
		contents: `import { env } from 'node:process';
import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: '../../../tests/e2e/browser',
 outputDir: '../../../test-results/browser',
 use: { headless: true, browserName: 'chromium', screenshot: 'only-on-failure' },
 workers: Number(env.HARNESS_RESOURCE_CPUS ?? 1),
 reporter: 'list'
});
`
	}
];
