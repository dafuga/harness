import { CommitContext, stageFiles } from '../planCommit';
import { Buffer } from "node:buffer";
import { copyFile, mkdir, mkdtemp, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Git } from "../planGit";
import { safePath } from "../planGit";
import type { Files } from "./planWrite";
import { fail, hash } from "../planData";
import { tmpdir } from "node:os";

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

/** Exercise the configured filter without writing repository objects, files, refs or config. */
export async function requireLfsFilters(git: Git): Promise<void> {
	let temp: string | undefined;
	try {
		await git.run(['lfs', 'version']);
		const config = (
			await git.run(['config', '--get-regexp', '^filter\\.lfs\\.(clean|process)$'])
		).toString();
		if (!config.split('\n').some((line) => /^filter\.lfs\.(clean|process)\s+\S/.test(line)))
			throw new Error('No configured LFS filter');
		temp = await mkdtemp(join(tmpdir(), 'planning-lfs-preflight-'));
		await writeFile(join(temp, '.gitattributes'), '*.png filter=lfs\n');
		const probe = 'harness-lfs-preflight\n';
		const pointer = `version https://git-lfs.github.com/spec/v1\noid sha256:${hash(probe)}\nsize ${Buffer.byteLength(probe)}\n`;
		const expected = await git.run(['hash-object', '--stdin'], pointer);
		const actual = await git.run(
			[
				'-C',
				temp,
				'-c',
				`lfs.storage=${join(temp, 'storage')}`,
				'-c',
				'filter.lfs.required=true',
				'hash-object',
				'--stdin',
				'--path=probe.png'
			],
			probe,
			{ GIT_DIR: git.dir, GIT_WORK_TREE: temp, GIT_INDEX_FILE: join(temp, 'index') }
		);
		if (!actual.equals(expected))
			throw new Error('Configured filter did not produce an LFS pointer');
	} catch {
		fail(
			'git-failed',
			'PNG designs require Git LFS; configure repository Git LFS filters before adding images'
		);
	} finally {
		if (temp) await rm(temp, { recursive: true, force: true });
	}
}
