import { svelte } from '@sveltejs/vite-plugin-svelte';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { entityPreviewAssets } from './entityPreviewAssets';

/** Where the preview of a run is built; a run names its own directory so two never share one. */
export const previewHome = (): string =>
	resolve(process.env.ENTITY_PREVIEW_HOME ?? '/tmp/harness-entity-preview');

/**
 * Builds the explorer content over the synthetic history as one script and one stylesheet, and
 * writes its media beside them. Only the preview is built, into its own directory: the build of
 * the application is neither read nor replaced.
 */
export async function buildEntityPreview(): Promise<void> {
	const home = previewHome();
	await build({
		configFile: false,
		root: resolve(process.env.ENTITY_PREVIEW_ROOT ?? '.'),
		plugins: [svelte()],
		logLevel: 'warn',
		build: {
			outDir: home,
			emptyOutDir: true,
			cssCodeSplit: false,
			lib: {
				entry: 'test/entityPreview.ts',
				formats: ['iife'],
				name: 'EntityPreview',
				fileName: 'preview'
			}
		}
	});
	writeFileSync(join(home, 'hashes.json'), JSON.stringify(entityPreviewAssets(home)));
}

/** Verification setup builds and identifies these files before browser checks begin. */
export default async function entityPreviewSetup(): Promise<void> {
	if (!process.env.HARNESS_VERIFY) await buildEntityPreview();
}
