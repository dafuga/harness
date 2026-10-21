import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fail } from '../../core/development-tooling/errors';
import type { IndexFile } from './consoleDataModules';

/** Every file of a history index directory, in path order, with its bytes. */
export async function indexFiles(directory: string): Promise<IndexFile[]> {
	if (!existsSync(join(directory, 'index.json'))) {
		fail(
			`${directory} is not a history index: run harness history build --out ${directory} first.`
		);
	}
	const entries = await readdir(directory, { withFileTypes: true, recursive: true });
	const paths = entries
		.filter((entry) => entry.isFile())
		.map((entry) => relative(directory, join(entry.parentPath, entry.name)).split(sep).join('/'));
	return Promise.all(
		paths.sort().map(async (path) => ({ path, bytes: await readFile(join(directory, path)) }))
	);
}
