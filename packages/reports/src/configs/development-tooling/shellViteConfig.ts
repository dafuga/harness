// @harness-uid u_mrt5j3ty2a
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin, type UserConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
// One page of the shell fixture as one script and one stylesheet: the shell alone over a made-up
// history, with no server, no index and no build of the application behind it. The run that
// builds it names the page and a directory of its own.
const page = process.env.SHELL_FIXTURE_PAGE ?? 'navbar';
// The catalog host installs these sheets for the selected app. Route imports must not spread
// one app's global styles across all three apps in the shared fixture bundle. Inline reads stay.
const contextStyles: Plugin = {
	name: 'catalog-context-styles',
	enforce: 'pre',
	resolveId(source) {
		if (/\/lib\/styles\/(?:base(?:-[23])?|gallery(?:-2)?|workspace|design|hub)\.css$/.test(source))
			return '\0catalog-context-styles';
		return null;
	},
	load(id) {
		return id === '\0catalog-context-styles' ? '' : null;
	}
};
export default defineConfig(async (): Promise<UserConfig> => {
	const data = page === 'catalog' ? await loadCatalogData() : '';
	return {
		define: {
			'process.env.NODE_ENV': JSON.stringify('production'),
			...(data ? { __COMPONENT_PREVIEW_DATA__: data } : {})
		},
		plugins: [page === 'catalog' && contextStyles, fixtureMedia(data), svelte()],
		resolve: ['components', 'catalog', 'outgoing'].includes(page)
			? {
					alias: {
						'$app/navigation': fileURLToPath(
							new URL(
								'../../../tests/e2e/support/component-previews/router.svelte.ts',
								import.meta.url
							)
						),
						'$app/state': fileURLToPath(
							new URL(
								'../../../tests/e2e/support/component-previews/router.svelte.ts',
								import.meta.url
							)
						),
						$desktop: fileURLToPath(new URL('../../../../desktop/src', import.meta.url)),
						$shared: fileURLToPath(new URL('../../components', import.meta.url)),
						$reports: fileURLToPath(new URL('../..', import.meta.url)),
						'$app/paths': fileURLToPath(
							new URL('../../../tests/e2e/support/shell/hubPaths.ts', import.meta.url)
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
	};
});

/** Bun resolves the source snapshot's generated workspace aliases before Vite has a config. */
async function loadCatalogData(): Promise<string> {
	const source = fileURLToPath(
		new URL('../../../tests/e2e/support/component-previews/buildData.ts', import.meta.url)
	);
	const script = `import { buildData } from ${JSON.stringify(source)}; process.stdout.write(JSON.stringify(await buildData()));`;
	const { stdout } = await promisify(execFile)('bun', ['-e', script], {
		encoding: 'utf8',
		maxBuffer: 16 * 1024 * 1024
	});
	return stdout;
}

/** Publish the original sealed bytes with the bundle, for its media router and admission check. */
function fixtureMedia(data: string): Plugin {
	return {
		name: 'catalog-fixture-media',
		generateBundle() {
			if (data) this.emitFile({ type: 'asset', fileName: 'preview-data.json', source: data });
		}
	};
}
