import { defineConfig } from '@playwright/test';

// The entity screens in a browser over a synthetic history: no application server, no real data.
export default defineConfig({
	testDir: '.',
	testMatch: /entity-preview[\w-]*\.spec\.ts/,
	workers: 1,
	globalSetup: './entityPreviewSetup.ts',
	reporter: 'list',
	// A run that asks for screenshots also keeps what the page showed where a check failed.
	use: {
		viewport: { width: 1440, height: 900 },
		screenshot: process.env.TAKE_SCREENSHOT === '1' ? 'only-on-failure' : 'off'
	}
});
