import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'coverage', '.svelte-kit', 'build']);

export async function collectAuditedFiles(root: string): Promise<string[]> {
	const entries = await readdir(root);
	const nested = await Promise.all(entries.map((entry) => collectEntry(root, entry)));
	return nested.flat();
}

async function collectEntry(root: string, entry: string): Promise<string[]> {
	const path = join(root, entry);
	const details = await stat(path);

	if (details.isDirectory()) {
		return ignoredDirs.has(entry) ? [] : collectAuditedFiles(path);
	}

	return isAuditedFile(path) ? [path] : [];
}

function isAuditedFile(path: string): boolean {
	return ['.ts', '.svelte', '.js'].some((extension) => path.endsWith(extension));
}
