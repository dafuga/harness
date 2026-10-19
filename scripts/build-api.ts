import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

/** Builds the side-effect-free public API, its declarations and the shipped kernel artifacts. */
const entries = ['contracts', 'runtime', 'verification', 'history', 'resources'];
const edgeEntries = ['edge', 'console'];

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
// These two run where there is no Node: they are bundled for the web platform, and the build
// fails if anything they reach imports a Node or Bun module.
for (const entry of edgeEntries) {
	const result = await Bun.build({
		entrypoints: [`src/lib/${entry}.ts`],
		target: 'browser',
		format: 'esm',
		outdir: 'dist/api',
		packages: 'external'
	});
	if (!result.success) throw new Error(`Edge bundle ${entry} failed.\n${result.logs.join('\n')}`);
	const code = await readFile(`dist/api/${entry}.js`, 'utf8');
	const foreign = code.match(/from\s+["'](node:[^"']+|bun[^"']*)["']|\brequire\(/);
	if (foreign) throw new Error(`Edge bundle ${entry} is not portable: it contains ${foreign[0]}`);
}

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
const built = [...entries, ...edgeEntries].join(', ');
console.log(`Built public API: ${built} and index, declarations in dist/types.`);
