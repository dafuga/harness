import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { runCommand } from './cli';

/** Scaffold checks install this build of the unreleased runtime, never an older npm release. */
export async function sqliteRuntimePackage(project: string): Promise<void> {
	const directory = join(dirname(project), 'sqlite-runtime');
	await mkdir(directory, { recursive: true });
	await runCommand(
		['bun', 'build', resolve('src/lib/sqlite.ts'), '--target', 'node', '--outdir', directory],
		process.cwd()
	);
	await writeFile(
		join(directory, 'sqlite.d.ts'),
		`export * from ${JSON.stringify(resolve('src/lib/sqlite'))};\n`
	);
	await writeFile(
		join(directory, 'package.json'),
		JSON.stringify({
			name: '@dafuga01/harness',
			version: '0.1.4',
			type: 'module',
			exports: { './sqlite': { types: './sqlite.d.ts', default: './sqlite.js' } }
		})
	);
	const path = join(project, 'package.json');
	const manifest = JSON.parse(await readFile(path, 'utf8'));
	manifest.dependencies = { ...manifest.dependencies, '@dafuga01/harness': `file:${directory}` };
	await writeFile(path, JSON.stringify(manifest, null, '\t') + '\n');
}
