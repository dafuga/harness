import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { freePorts } from '../../utils/development-tooling/e2e-fixtures/e2eFixtures';
// A verification starts a preview of its own snapshot on a port of its own, so two at once do
// not meet; the port is written to the environment for the workers of the same run.
if (process.env.HARNESS_VERIFY) process.env.HARNESS_PICKER_PREVIEW_PORT ??= String(freePorts(1)[0]);
const port = Number(process.env.HARNESS_PICKER_PREVIEW_PORT || 47839);
const origin = process.env.HARNESS_PICKER_PREVIEW_URL ?? `http://127.0.0.1:${port}`;
// The picker is served by its own preview, not by the reports application, so this suite builds
// the panel and starts that preview with a fresh state before the test.
const root = fileURLToPath(new URL('../../../../..', import.meta.url));
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
				// A verification tests the preview of its own snapshot, never one already running.
				reuseExistingServer: !process.env.HARNESS_VERIFY
			}
});
