import { defineConfig } from '@playwright/test';
export default defineConfig({
	testDir: '../../tests/e2e',
	testMatch: 'provider-picker.spec.ts',
	workers: 1,
	use: {
		baseURL: process.env.HARNESS_PICKER_PREVIEW_URL ?? 'http://127.0.0.1:47839',
		viewport: { width: 900, height: 900 }
	},
	reporter: 'list'
});
