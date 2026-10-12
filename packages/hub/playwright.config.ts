import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	webServer: {
		command: 'bun run dev',
		url: 'http://127.0.0.1:5798',
		reuseExistingServer: true
	},
	use: {
		baseURL: 'http://127.0.0.1:5798'
	}
});
