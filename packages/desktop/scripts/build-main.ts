import { mkdir } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

const jsoncParser: Bun.BunPlugin = {
	name: 'bundle-jsonc-parser-module',
	setup(build) {
		build.onResolve({ filter: /^jsonc-parser$/ }, async () => {
			const manifest = Bun.resolveSync('jsonc-parser/package.json', import.meta.dir);
			const definition = (await Bun.file(manifest).json()) as { module?: string };
			if (!definition.module) throw new Error('The JSONC parser declares no ESM bundle entry.');
			return { path: resolve(dirname(manifest), definition.module) };
		});
	}
};
export const desktopNodeOptions = {
	target: 'node' as const,
	format: 'cjs' as const,
	external: ['electron'],
	plugins: [jsoncParser],
	outdir: 'dist',
	sourcemap: 'external' as const
};

/** The same native bundle boundary is exercised by the packaged-Node checks. */
export async function buildDesktopBundle(entry: string, output: string): Promise<void> {
	await mkdir(dirname(output), { recursive: true });
	const result = await Bun.build({
		...desktopNodeOptions,
		entrypoints: [entry],
		outdir: dirname(output),
		naming: basename(output)
	});
	if (!result.success) throw new Error(result.logs.map(String).join('\n'));
}

if (import.meta.main) {
	for (const [entry, out] of [
		['src/initializers/initializeDesktop.ts', 'main.cjs'],
		['src/initializers/initializePreload.ts', 'preload.cjs']
	])
		await buildDesktopBundle(entry, `dist/${out}`);
}
