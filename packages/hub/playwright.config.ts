import { defineConfig } from '@playwright/test';

/**
 * A browser run starts its own preview on a port no development server uses, and never takes a
 * server that is already there. HARNESS_HUB_TEST_PORT names another free port.
 */
function previewPort(): number {
	const named = process.env.HARNESS_HUB_TEST_PORT ?? '5795';
	const port = /^\d+$/.test(named) ? Number(named) : NaN;
	if (port >= 1024 && port <= 65535) return port;
	throw new Error(`HARNESS_HUB_TEST_PORT must be a port from 1024 to 65535, not "${named}".`);
}
const port = previewPort();
const url = `http://127.0.0.1:${port}`;

export default defineConfig({
	testDir: 'tests/e2e',
	webServer: {
		command: `bun run dev --port ${port}`,
		url,
		reuseExistingServer: false
	},
	use: {
		baseURL: url
	}
});
