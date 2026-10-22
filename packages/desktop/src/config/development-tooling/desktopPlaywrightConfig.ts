import { defineConfig } from '@playwright/test';
import { freePort } from '../../../../../test/support/workers';

const verifying = process.env.HARNESS_VERIFY === '1';

/**
 * Every run owns a free loopback port and refuses an existing server. An explicit port is
 * honored in both modes; no test may silently navigate to another run's renderer.
 */
async function previewPort(): Promise<number> {
	const named = process.env.HARNESS_DESKTOP_TEST_PORT;
	if (named === undefined) return freePort();
	const port = /^\d+$/.test(named) ? Number(named) : NaN;
	if (port >= 1024 && port <= 65535) return port;
	throw new Error(`HARNESS_DESKTOP_TEST_PORT must be a port from 1024 to 65535, not "${named}".`);
}
const port = await previewPort();
const url = `http://127.0.0.1:${port}`;

export const desktopPlaywrightConfig = defineConfig({
	testDir: 'tests/e2e',
	workers: 1,
	webServer: {
		env: { HARNESS_DESKTOP_TEST_PORT: String(port) },
		command: verifying
			? 'bun tests/e2e/desktop-static-server.ts'
			: `bun run sync:shared && bun x vite dev --host 127.0.0.1 --port ${port} --strictPort`,
		url,
		reuseExistingServer: false
	},
	use: {
		baseURL: url,
		viewport: { width: 1440, height: 900 }
	}
});

export default desktopPlaywrightConfig;
