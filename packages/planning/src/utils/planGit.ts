import process from 'node:process';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { lstat, realpath, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fail, hash } from './planData';
export interface Git {
	root: string;
	dir: string;
	transactionHead?: string;
	run(args: string[], input?: Uint8Array | string, env?: Record<string, string>): Promise<Buffer>;
}
export async function planGit(root: string): Promise<Git> {
	const canonical = await realpath(root);
	const run: Git['run'] = (args, input, env) =>
		new Promise((resolve, reject) => {
			const child = spawn('git', args, {
				cwd: canonical,
				env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', ...env },
				stdio: 'pipe'
			});
			const out: Buffer[] = [];
			const errors: Buffer[] = [];
			child.stdout.on('data', (data) => out.push(data));
			child.stderr.on('data', (data) => errors.push(data));
			child.on('error', reject);
			child.on('close', (code) =>
				code === 0
					? resolve(Buffer.concat(out))
					: reject(
							Object.assign(
								new Error(Buffer.concat(errors).toString().trim() || 'Git command failed'),
								{ code: 'git-failed' }
							)
						)
			);
			child.stdin.on('error', () => {});
			child.stdin.end(input);
		});
	const top = (await run(['rev-parse', '--show-toplevel'])).toString().trim();
	if (top !== canonical) fail('not-a-repository', 'Select the repository root');
	const dir = (await run(['rev-parse', '--absolute-git-dir'])).toString().trim();
	return { root: canonical, dir, run };
}
export async function revision(git: Git, value = 'HEAD'): Promise<string> {
	if (typeof value !== 'string' || !value || value.startsWith('-') || /[\0\r\n]/.test(value))
		fail('unknown-revision', 'Invalid revision');
	try {
		return (await git.run(['rev-parse', '--verify', `${value}^{commit}`])).toString().trim();
	} catch {
		return fail('unknown-revision', 'Unknown revision');
	}
}
export async function paths(git: Git, rev: string, path = ''): Promise<string[]> {
	const result = await git.run(['ls-tree', '-rz', rev, '--', path || '.']);
	return result
		.toString()
		.split('\0')
		.filter(Boolean)
		.map((line) => line.split('\t')[1]);
}
export async function blob(git: Git, rev: string, path: string): Promise<Buffer> {
	const entry = (await git.run(['ls-tree', '-z', rev, '--', path])).toString();
	if (!entry) fail('artifact-missing', `Missing artifact ${path}`);
	if (!entry.startsWith('100644 ') && !entry.startsWith('100755 '))
		fail('unsafe-path', 'Non-regular artifact');
	return git.run(['show', `${rev}:${path}`]);
}
export async function imageBlob(git: Git, rev: string, path: string): Promise<Buffer> {
	const data = await blob(git, rev, path);
	if (!data.toString('utf8', 0, 50).startsWith('version https://git-lfs.github.com/spec/v1'))
		return fail('artifact-corrupt', 'Image is not a Git LFS pointer');
	const pointer =
		/^version https:\/\/git-lfs.github.com\/spec\/v1\noid sha256:([a-f0-9]{64})\nsize (\d+)\n$/.exec(
			data.toString()
		);
	if (!pointer) fail('artifact-corrupt', 'Malformed LFS pointer');
	const oid = pointer[1];
	const common = (await git.run(['rev-parse', '--git-common-dir'])).toString().trim();
	const object = resolve(git.root, common, 'lfs', 'objects', oid.slice(0, 2), oid.slice(2, 4), oid);
	let bytes: Buffer;
	try {
		bytes = await readFile(object);
	} catch {
		return fail('artifact-missing', 'LFS image content is missing');
	}
	if (hash(bytes) !== oid || bytes.length !== Number(pointer[2]))
		fail('artifact-tampered', 'LFS object hash mismatch');
	return bytes;
}
export async function safePath(git: Git, path: string): Promise<void> {
	let current = git.root;
	for (const part of path.split('/')) {
		if (!part || part === '..' || part === '.') fail('unsafe-path', 'Unsafe path');
		current = join(current, part);
		try {
			if ((await lstat(current)).isSymbolicLink()) fail('unsafe-path', 'Symlink artifact path');
		} catch (error) {
			if ((error as { code?: string }).code !== 'ENOENT') throw error;
		}
	}
}
export async function containing(git: Git, rev: string, path: string): Promise<string> {
	return (
		(await git.run(['log', '--format=%H', '--diff-filter=A', rev, '--', path]))
			.toString()
			.trim()
			.split('\n')
			.at(-1) || fail('artifact-tampered', 'Artifact has no creation commit')
	);
}
