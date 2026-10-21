import { mkdir } from 'node:fs/promises';
import { basename, dirname } from 'node:path';

/** The same native bundle boundary is exercised by the packaged-Node checks. */
export async function buildDesktopBundle(entry: string, output: string): Promise<void> {
	await mkdir(dirname(output), { recursive: true });
	const result = await Bun.build({
		entrypoints: [entry],
		target: 'node',
		format: 'cjs',
		external: ['electron'],
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
