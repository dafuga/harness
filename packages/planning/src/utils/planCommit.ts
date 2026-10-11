import { copyFile, mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Git } from './planGit';
import { safePath } from './planGit';
import type { Files } from './planWrite';
import { fail } from './planData';
export async function stageFiles(git: Git, files: Files, index: string): Promise<void> {
	for (const [path, content] of Object.entries(files)) {
		await safePath(git, path);
		const data = path.endsWith('.png')
			? await git.run(['lfs', 'clean', '--', path], content)
			: content;
		const oid = (await git.run(['hash-object', '-w', '--stdin'], data)).toString().trim();
		await git.run(['update-index', '--add', '--cacheinfo', `100644,${oid},${path}`], undefined, {
			GIT_INDEX_FILE: index
		});
	}
}
async function materialize(git: Git, files: Files): Promise<void> {
	for (const [path, content] of Object.entries(files)) {
		await safePath(git, path);
		await mkdir(dirname(join(git.root, path)), { recursive: true });
		await writeFile(join(git.root, path), content);
	}
}
async function backupFiles(git: Git, files: Files): Promise<Map<string, Uint8Array | null>> {
	const backups = new Map<string, Uint8Array | null>();
	for (const path of Object.keys(files)) {
		try {
			backups.set(path, await readFile(join(git.root, path)));
		} catch (error) {
			if ((error as { code?: string }).code !== 'ENOENT') throw error;
			backups.set(path, null);
		}
	}
	return backups;
}
async function restoreFiles(git: Git, backups: Map<string, Uint8Array | null>): Promise<void> {
	for (const [path, content] of backups) {
		if (content === null) await rm(join(git.root, path), { force: true });
		else await writeFile(join(git.root, path), content);
	}
}
export interface CommitContext {
	parent: string;
	branch: string;
	commit: string;
	temp: string;
}
export async function planCommit(git: Git, files: Files, context: CommitContext): Promise<void> {
	const realIndex = join(git.dir, 'index');
	const lock = `${realIndex}.lock`;
	let handle;
	try {
		handle = await open(lock, 'wx');
	} catch {
		return fail('repository-busy', 'Git index is locked');
	}
	await handle.close();
	const nextIndex = join(context.temp, 'next-index');
	let advanced = false;
	let backups = new Map<string, Uint8Array | null>();
	try {
		backups = await backupFiles(git, files);
		await copyFile(realIndex, nextIndex);
		await stageFiles(git, files, nextIndex);
		await materialize(git, files);
		const branch = (await git.run(['symbolic-ref', '--short', 'HEAD'])).toString().trim();
		if (branch !== context.branch) fail('conflict', 'Branch changed during planning operation');
		await git.run(['update-ref', `refs/heads/${branch}`, context.commit, context.parent]);
		advanced = true;
		await copyFile(nextIndex, lock);
		await rename(lock, realIndex);
	} catch (error) {
		if (advanced)
			await git.run(['update-ref', `refs/heads/${context.branch}`, context.parent, context.commit]);
		await restoreFiles(git, backups);
		throw error;
	} finally {
		await rm(lock, { force: true });
	}
}
