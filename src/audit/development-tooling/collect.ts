import { lstat, readdir } from 'node:fs/promises';
import { extname } from 'node:path';
import { join } from 'node:path';

const ignoredDirs = new Set([
	'.cache',
	'.git',
	'.gradle',
	'.svelte-kit',
	'.wrangler',
	'.wxt',
	'__screenshots__',
	'android',
	'build',
	'coverage',
	'dist',
	'ios',
	'node_modules',
	'Pods',
	'playwright-report',
	'target',
	'test-results',
	'tmp'
]);

export interface CollectedFile {
	path: string;
	extension: string;
}

export interface CollectedFiles {
	files: CollectedFile[];
	dirs: string[];
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
		dirs: nested.flatMap((result) => result.dirs),
		ignoredPaths: nested.flatMap((result) => result.ignoredPaths)
	};
}

async function collectEntry(root: string, entry: string, prefix: string): Promise<CollectedFiles> {
	const path = join(root, entry);
	const details = await lstat(path);
	const relativePath = prefix ? `${prefix}/${entry}` : entry;

	if (details.isSymbolicLink()) {
		return { files: [], dirs: [], ignoredPaths: [relativePath] };
	}

	if (details.isDirectory()) {
		return ignoredDirs.has(entry)
			? { files: [], dirs: [], ignoredPaths: [`${relativePath}/`] }
			: collectDirectory(path, relativePath);
	}

	return { files: [{ path, extension: extname(entry).toLowerCase() }], dirs: [], ignoredPaths: [] };
}

async function collectDirectory(path: string, relativePath: string): Promise<CollectedFiles> {
	const collected = await collectFiles(path, relativePath);
	return {
		files: collected.files,
		dirs: [`${relativePath}/`, ...collected.dirs],
		ignoredPaths: collected.ignoredPaths
	};
}
