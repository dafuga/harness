import { defineConfig } from '@playwright/test';
// The shell is looked at alone: its specs build their fixture pages themselves and answer their
// requests from those files, so this run starts no server, seeds nothing and builds no application.
export default defineConfig({
	testDir: '../../tests/e2e',
	testMatch: /[\\/]explorer-shell[^\\/]*\.spec\.ts$/,
	workers: 1,
	outputDir: '../../test-results/explorer-shell',
	use: { screenshot: 'only-on-failure' },
	reporter: 'list'
});
