import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

/** Builds the side-effect-free public API, its declarations and the shipped kernel artifacts. */
const entries = ['contracts', 'runtime', 'verification', 'history'];

for (const directory of ['dist/api', 'dist/types', 'dist/kernel']) {
	await rm(directory, { recursive: true, force: true });
}
// Each entry is bundled on its own: code splitting currently emits duplicate exports.
for (const entry of entries) {
	const result = await Bun.build({
		entrypoints: [`src/lib/${entry}.ts`],
		target: 'node',
		format: 'esm',
		outdir: 'dist/api',
		packages: 'external'
	});
	if (!result.success) throw new Error(`Public API bundle failed.\n${result.logs.join('\n')}`);
}
await writeFile(
	'dist/api/index.js',
	entries.map((entry) => `export * from './${entry}.js';\n`).join('')
);

const declarations = Bun.spawnSync(['bun', 'x', 'tsc', '-p', 'tsconfig.api.json'], {
	stdout: 'inherit',
	stderr: 'inherit'
});
if (declarations.exitCode !== 0) throw new Error('Public API declarations failed.');

await mkdir('dist/kernel/measurements', { recursive: true });
for (const file of ['impact-kernel.wasm', 'build.json']) {
	await cp(`target/kernel/${file}`, `dist/kernel/${file}`);
}
await cp('specification/measurements/impact-kernel', 'dist/kernel/measurements', {
	recursive: true,
	force: true
}).catch(() => undefined);
console.log(`Built public API: ${entries.join(', ')} and index, declarations in dist/types.`);
