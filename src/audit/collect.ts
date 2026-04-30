import { readdir, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { join } from 'node:path';

const ignoredDirs = new Set([
	'.cache',
	'.git',
	'.gradle',
	'.svelte-kit',
	'.wxt',
	'build',
	'coverage',
	'dist',
	'node_modules',
	'Pods',
	'target'
]);

export interface CollectedFile {
	path: string;
	extension: string;
}

export interface CollectedFiles {
	files: CollectedFile[];
	ignoredPaths: string[];
}

export async function collectAuditedFiles(root: string): Promise<CollectedFiles> {
	return collectFiles(root, '');
}

async function collectFiles(root: string, prefix: string): Promise<CollectedFiles> {
	const entries = await readdir(root);
	const nested = await Promise.all(entries.map((entry) => collectEntry(root, entry, prefix)));

	return {
		files: nested.flatMap((result) => result.files),
		ignoredPaths: nested.flatMap((result) => result.ignoredPaths)
	};
}

async function collectEntry(root: string, entry: string, prefix: string): Promise<CollectedFiles> {
	const path = join(root, entry);
	const details = await stat(path);
	const relativePath = prefix ? `${prefix}/${entry}` : entry;

	if (details.isDirectory()) {
		return ignoredDirs.has(entry)
			? { files: [], ignoredPaths: [`${relativePath}/`] }
			: collectFiles(path, relativePath);
	}

	return { files: [{ path, extension: extname(entry).toLowerCase() }], ignoredPaths: [] };
}
