// @harness-uid u_ymrcybx25k
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import type { Dirent } from 'node:fs';
import {
	chmod,
	copyFile,
	lstat,
	mkdir,
	open,
	readdir,
	readlink,
	rename,
	rm,
	rmdir,
	symlink
} from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** Reconcile a fully extracted snapshot without following worktree links. */
export async function reconcileDockerWorkspace(from: string, to: string): Promise<void> {
	await reconcileDirectory(from, to, '');
}

async function reconcileDirectory(from: string, to: string, directory: string): Promise<void> {
	const files = await entries(from, directory);
	const previous = await entries(to, directory);
	for (const [name, entry] of previous) {
		if (!files.has(name)) await removeEntry(join(to, name), entry, join(directory, name));
	}
	for (const [name, entry] of files) {
		await reconcileEntry(join(from, name), join(to, name), join(directory, name), {
			entry,
			previous: previous.get(name)
		});
	}
}

async function entries(path: string, directory: string): Promise<Map<string, Dirent>> {
	const result = new Map<string, Dirent>();
	const { dev } = await lstat(path);
	for (const entry of await readdir(path, { withFileTypes: true })) {
		if (reserved(entry.name, directory)) continue;
		if (entry.isDirectory() && (await lstat(join(path, entry.name))).dev !== dev) continue;
		if (!entry.isFile() && !entry.isDirectory() && !entry.isSymbolicLink())
			throw new Error('Workspace contains an unsupported file type.');
		result.set(entry.name, entry);
	}
	return result;
}

function reserved(name: string, directory: string): boolean {
	const key = name.toLowerCase();
	const inHarnessCache = `/${directory.toLowerCase()}`.endsWith('/.cache/harness');
	return (
		key === '.git' ||
		key === 'node_modules' ||
		(inHarnessCache && (key === 'bun' || key === 'task-worktrees'))
	);
}

async function removeEntry(path: string, entry: Dirent, relative: string): Promise<void> {
	if (!entry.isDirectory()) {
		await rm(path);
		return;
	}
	for (const [name, child] of await entries(path, relative)) {
		await removeEntry(join(path, name), child, join(relative, name));
	}
	// Keep enclosing directories for protected host metadata and packages.
	await rmdir(path).catch((error: unknown) => {
		if (!(error instanceof Error && 'code' in error && error.code === 'ENOTEMPTY')) throw error;
	});
}

async function reconcileEntry(
	from: string,
	to: string,
	relative: string,
	{ entry, previous }: { entry: Dirent; previous?: Dirent }
): Promise<void> {
	if (entry.isDirectory()) {
		if (previous && !previous.isDirectory()) await rm(to);
		if (!previous?.isDirectory()) await mkdir(to);
		await reconcileDirectory(from, to, relative);
		return;
	}
	if (previous?.isDirectory()) await removeEntry(to, previous, relative);
	await reconcileLeaf(from, to, entry, previous);
}

async function reconcileLeaf(
	from: string,
	to: string,
	entry: Dirent,
	previous?: Dirent
): Promise<void> {
	if (entry.isSymbolicLink()) {
		const link = await readlink(from);
		if (previous?.isSymbolicLink() && (await readlink(to)) === link) return;
		await replaceFile(to, (path) => symlink(link, path));
		return;
	}
	await reconcileFile(from, to, previous?.isFile() ?? false);
}

async function reconcileFile(from: string, to: string, existed: boolean): Promise<void> {
	const source = await lstat(from);
	const mode = source.mode & 0o777;
	if (existed && (await sameFile(from, to, source.size, mode))) return;
	await replaceFile(to, async (path) => {
		await copyFile(from, path, constants.COPYFILE_EXCL);
		await chmod(path, mode);
	});
}

async function sameFile(from: string, to: string, size: number, mode: number): Promise<boolean> {
	const target = await lstat(to);
	if (target.size !== size || (target.mode & 0o777) !== mode) return false;
	const [edited, original] = await Promise.all([fileHash(from), fileHash(to)]);
	return edited === original;
}

async function fileHash(path: string): Promise<string> {
	const hash = createHash('sha256');
	const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
	for await (const chunk of file.createReadStream()) {
		hash.update(chunk);
	}
	return hash.digest('hex');
}

async function replaceFile(to: string, write: (path: string) => Promise<void>): Promise<void> {
	const temp = join(dirname(to), `.harness-docker-${randomUUID()}`);
	try {
		await write(temp);
		await rename(temp, to);
	} finally {
		await rm(temp, { force: true });
	}
}
