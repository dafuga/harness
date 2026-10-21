import { mkdir } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

/** The same native bundle boundary is exercised by the packaged-Node checks. */
export async function buildDesktopBundle(entry: string, output: string): Promise<void> {
	await mkdir(dirname(output), { recursive: true });
	const manifest = Bun.resolveSync('jsonc-parser/package.json', import.meta.dir);
	const definition = (await Bun.file(manifest).json()) as { module?: string };
	if (!definition.module) throw new Error('The JSONC parser declares no ESM bundle entry.');
	const jsoncModule = resolve(dirname(manifest), definition.module);
	const result = await Bun.build({
		entrypoints: [entry],
		target: 'node',
		format: 'cjs',
		external: ['electron'],
		// Bundle the declared ESM distribution; Bun cannot flatten the UMD factory's requires.
		plugins: [
			{
				name: 'jsonc-parser-module',
				setup(builder) {
					builder.onResolve({ filter: /^jsonc-parser$/ }, () => ({ path: jsoncModule }));
				}
			}
		],
		outdir: dirname(output),
		naming: basename(output),
		sourcemap: 'external'
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
