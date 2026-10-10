import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const port = Number(process.env.HARNESS_PICKER_PREVIEW_PORT || 47839);
const origin = process.env.HARNESS_PICKER_PREVIEW_URL ?? `http://127.0.0.1:${port}`;
// The picker is served by its own preview, not by the reports application, so this suite builds
// the panel and starts that preview with a fresh state before the test.
const root = fileURLToPath(new URL('../../../..', import.meta.url));
const preview = [
	'bun run build:picker',
	'rm -rf .cache/codex-picker-preview',
	`bun src/index.ts codex picker-preview --panel-file plugins/claude-picker/dist/panel.html --port ${port}`
].join(' && ');
export default defineConfig({
	testDir: '../../tests/e2e',
	testMatch: 'provider-picker.spec.ts',
	workers: 1,
	use: { baseURL: origin, viewport: { width: 900, height: 900 } },
	reporter: 'list',
	webServer: process.env.HARNESS_PICKER_PREVIEW_URL
		? undefined
		: {
				command: preview,
				cwd: root,
				url: `${origin}/preview`,
				timeout: 180_000,
				reuseExistingServer: true
			}
});
