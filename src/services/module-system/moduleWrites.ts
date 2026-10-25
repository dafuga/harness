import { lstat, readFile, realpath, mkdir, writeFile, unlink } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import type { PlannedFile } from '../../core/development-tooling/files';

/** Validate the entire plan before writing; refuse symlink traversal and accidental overwrites. */
export async function writeModuleFiles(
	root: string,
	files: PlannedFile[],
	replace: string[] = [],
	allowIdentical = true
): Promise<string[]> {
	const canonical = await realpath(root);
	const seen = new Set<string>();
	const plans: Array<PlannedFile & { previous?: string }> = [];
	for (const file of files) {
		const path = moduleOutputPath(file.path);
		if (seen.has(path)) throw new Error(`Duplicate module output: ${path}`);
		seen.add(path);
		await assertNoLinks(canonical, path);
		const previous = await existing(join(canonical, path));
		if (
			previous !== undefined &&
			(!allowIdentical || previous !== file.contents) &&
			!replace.includes(path)
		)
			throw new Error(`Refusing to overwrite existing ${path}.`);
		if (previous !== file.contents) plans.push({ ...file, path, previous });
	}
	const written: typeof plans = [];
	try {
		for (const file of plans) {
			await mkdir(dirname(join(canonical, file.path)), { recursive: true });
			await writeFile(join(canonical, file.path), file.contents, {
				flag: file.previous === undefined ? 'wx' : 'w'
			});
			written.push(file);
		}
	} catch (error) {
		await rollback(canonical, written);
		throw error;
	}
	return plans.map((file) => file.path);
}

export function moduleOutputPath(path: string): string {
	if (
		!/^(?:src|test|tests|specification|db)\/[A-Za-z0-9_.+@/{}-]+$/.test(path) &&
		!['package.json', 'harness.groups.json', 'harness.modules.json'].includes(path)
	)
		throw new Error(`Unsafe module output path: ${path}`);
	if (
		path
			.split('/')
			.some((part) => !part || part === '.' || part === '..' || part === 'node_modules') ||
		path.includes('{{')
	)
		throw new Error(`Unsafe module output path: ${path}`);
	return path;
}

async function assertNoLinks(root: string, path: string): Promise<void> {
	let target = root;
	for (const segment of path.split('/')) {
		target = resolve(target, segment);
		if (relative(root, target).startsWith('..')) throw new Error('Module path escapes project.');
		try {
			if ((await lstat(target)).isSymbolicLink())
				throw new Error(`Module output crosses symlink: ${path}`);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
	}
}

async function existing(path: string): Promise<string | undefined> {
	try {
		return await readFile(path, 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		return undefined;
	}
}

async function rollback(
	root: string,
	written: Array<PlannedFile & { previous?: string }>
): Promise<void> {
	for (const file of written.reverse()) {
		if (file.previous === undefined) await unlink(join(root, file.path));
		else await writeFile(join(root, file.path), file.previous);
	}
}
