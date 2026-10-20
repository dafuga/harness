import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
// One page of the shell fixture as one script and one stylesheet: the shell alone over a made-up
// history, with no server, no index and no build of the application behind it. The run that
// builds it names the page and a directory of its own.
const page = process.env.SHELL_FIXTURE_PAGE ?? 'navbar';
export default defineConfig({
	plugins: [svelte()],
	resolve:
		page === 'components'
			? {
					alias: {
						$desktop: fileURLToPath(new URL('../../../desktop/src', import.meta.url)),
						$shared: fileURLToPath(new URL('../components', import.meta.url)),
						'$app/paths': fileURLToPath(
							new URL('../../tests/e2e/support/shell/hubPaths.ts', import.meta.url)
						)
					}
				}
			: undefined,
	publicDir: false,
	logLevel: 'warn',
	build: {
		outDir: process.env.SHELL_FIXTURE_OUT ?? `output/shell-fixture/${page}`,
		emptyOutDir: true,
		cssCodeSplit: false,
		lib: {
			entry: `tests/e2e/support/shell/${page}Entry.ts`,
			formats: ['iife'],
			name: 'ShellFixture',
			fileName: 'page'
		}
	}
});
