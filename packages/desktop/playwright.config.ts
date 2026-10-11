import { defineConfig } from '@playwright/test';
export default defineConfig({
	testDir: 'tests/e2e',
	workers: 1,
	webServer: {
		command:
			process.env.HARNESS_VERIFY === '1' ? 'bun tests/e2e/desktop-static-server.ts' : 'bun run dev',
		url: process.env.HARNESS_VERIFY === '1' ? 'http://127.0.0.1:5797' : 'http://127.0.0.1:5796',
		reuseExistingServer: !process.env.CI && process.env.HARNESS_VERIFY !== '1'
	},
	use: {
		baseURL: process.env.HARNESS_VERIFY === '1' ? 'http://127.0.0.1:5797' : 'http://127.0.0.1:5796',
		viewport: { width: 1440, height: 900 }
	}
});
