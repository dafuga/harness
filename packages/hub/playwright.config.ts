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
const verifying = process.env.HARNESS_VERIFY === '1';
const downloads = verifying && process.env.HARNESS_HUB_TEST_MAC_DOWNLOAD === '1';
const persist = `.cache/playwright-hub-${port}`;
const archiveKey = 'releases/mac-arm64/1111111111111111111111111111111111111111/Harness.zip';
const fixtureBucket = 'harness-fixture-mac-downloads';
const wrangler = 'WRANGLER_SEND_METRICS=false bun x --no-install wrangler';
const worker =
	`${wrangler} pages dev .svelte-kit/cloudflare` +
	' --bundle --compatibility-date 2026-10-12 --compatibility-flag nodejs_compat' +
	` --ip 127.0.0.1 --port ${port} --persist-to ${persist}`;
const builtHub = downloads
	? `printf 'synthetic mac archive' | ${wrangler} r2 object put ${fixtureBucket}/${archiveKey}` +
		` --local --pipe --persist-to ${persist} && ${worker} --r2 DOWNLOADS=${fixtureBucket}` +
		` --binding HARNESS_MAC_DOWNLOAD_KEY=${archiveKey}`
	: worker;

export default defineConfig({
	testDir: 'tests/e2e',
	webServer: {
		command: verifying ? builtHub : `bun run dev --port ${port}`,
		url,
		timeout: verifying ? 180_000 : 60_000,
		reuseExistingServer: false
	},
	use: {
		baseURL: url
	}
});
