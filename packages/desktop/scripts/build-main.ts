import { mkdir } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const [entry, out] of [
	['src/initializers/initializeDesktop.ts', 'main.cjs'],
	['src/initializers/initializePreload.ts', 'preload.cjs']
]) {
	const result = await Bun.build({
		entrypoints: [entry],
		target: 'node',
		format: 'cjs',
		external: ['electron'],
		outdir: 'dist',
		naming: out,
		sourcemap: 'external'
	});
	if (!result.success) throw new Error(result.logs.map(String).join('\n'));
}
