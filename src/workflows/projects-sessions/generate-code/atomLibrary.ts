import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { atomicSyntax } from '../../../templates/development-tooling/atomicSyntax.js';
import { atomicComponentFiles } from '../../../templates/development-tooling/atomicComponents';
import { fail } from '../../../core/development-tooling/errors';
import { groupedImports } from './groupedImports';
import type { PlannedFile } from '../../../core/development-tooling/files';

/** Find the already used native atom definitions, including a shared workspace library. */
export function atomLibrary(root: string): string {
	const source = join(root, 'src');
	if (!existsSync(source)) return 'src/components/atoms';
	const directories = new Set<string>();
	for (const entry of readdirSync(source, { recursive: true, withFileTypes: true })) {
		if (!entry.isFile() || !entry.name.endsWith('.svelte')) continue;
		const path = join(entry.parentPath, entry.name);
		const target = declaredLibrary(path);
		if (target) directories.add(target);
	}
	if (directories.size > 1)
		fail(
			'Multiple native atom libraries are in use; reconcile the shared library before generating UI.'
		);
	return directories.size ? relative(root, [...directories][0]) : 'src/components/atoms';
}

/** Redirect generated imports and declarations to the existing library; never copy it twice. */
export function useAtomLibrary(files: PlannedFile[], directory: string): PlannedFile[] {
	if (directory === 'src/components/atoms') return files;
	const paths = new Map(
		atomicComponentFiles()
			.filter((file) => file.path.endsWith('.svelte'))
			.map((file) => [file.path, directory + '/' + file.path.split('/').at(-1)])
	);
	return files.map((file) => ({
		...file,
		contents: file.path.endsWith('.svelte')
			? groupedImports(file.contents, file.path, file.path, paths).replace(
					/<!-- @harness-atoms \S+ -->/,
					`<!-- @harness-atoms ${relative(dirname(file.path), directory).startsWith('.') ? relative(dirname(file.path), directory) : './' + relative(dirname(file.path), directory)} -->`
				)
			: file.contents
	}));
}

function declaredLibrary(path: string) {
	const code = readFileSync(path, 'utf8');
	if (!code.includes('@harness-atoms')) return undefined;
	let directory;
	try {
		directory = atomicSyntax(code).directory;
	} catch {
		return undefined;
	}
	if (!directory) return undefined;
	const target = resolve(dirname(path), directory);
	return existsSync(join(target, 'HtmlButton.svelte')) ? target : undefined;
}
