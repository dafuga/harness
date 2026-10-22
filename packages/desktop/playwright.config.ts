import { defineConfig } from '@playwright/test';

const verifying = process.env.HARNESS_VERIFY === '1';

/**
 * An ordinary run owns an isolated Vite fixture, outside the app-managed preview slot, and never takes
 * a server that is already there. HARNESS_DESKTOP_TEST_PORT names another free port.
 */
function previewPort(): number {
	const named = process.env.HARNESS_DESKTOP_TEST_PORT ?? '5796';
	const port = /^\d+$/.test(named) ? Number(named) : NaN;
	if (port >= 1024 && port <= 65535) return port;
	throw new Error(`HARNESS_DESKTOP_TEST_PORT must be a port from 1024 to 65535, not "${named}".`);
}
const port = verifying ? 5797 : previewPort();
const url = `http://127.0.0.1:${port}`;
// The Electron acceptance launches the built app itself; only `test:native` names its project.
const native = /[\\/]native-desktop\.spec\.ts$/;

export default defineConfig({
	testDir: 'tests/e2e',
	workers: 1,
	webServer: {
		command: verifying
			? 'bun tests/e2e/desktop-static-server.ts'
			: `bun run sync:shared && bun x vite dev --host 127.0.0.1 --port ${port} --strictPort`,
		url,
		reuseExistingServer: false
	},
	use: {
		baseURL: url,
		viewport: { width: 1440, height: 900 }
	},
	projects: [
		{ name: 'chromium', testIgnore: native, use: { browserName: 'chromium', headless: true } },
		{ name: 'native', testMatch: native }
	]
});
