import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { fail } from '../../../core/development-tooling/errors';

/** Enumerate only the requested specification directory; never follow symlinks. */
export async function contractFiles(directory: string): Promise<string[]> {
	let entries;
	try {
		entries = await fs.readdir(directory, { withFileTypes: true });
	} catch (error) {
		if ((error as { code?: string }).code === 'ENOENT') return [];
		throw error;
	}
	const paths = await Promise.all(
		entries.map(async (entry) => {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) return contractFiles(path);
			return entry.isFile() && entry.name.endsWith('.json') ? [path] : [];
		})
	);
	return paths.flat().sort();
}

export async function readContractJson(path: string, label: string): Promise<unknown> {
	try {
		return JSON.parse(await fs.readFile(path, 'utf8')) as unknown;
	} catch {
		return fail(`Cannot read JSON contract ${label}.`);
	}
}
