import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export function git(root: string, ...args: string[]) {
	return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}
export async function project(root: string) {
	await mkdir(root);
	git(root, 'init', '-b', 'feat/native');
	git(root, 'lfs', 'install', '--local');
	git(root, 'config', 'user.name', 'Harness Native Fixture');
	git(root, 'config', 'user.email', 'fixture@example.invalid');
	git(root, 'config', 'commit.gpgsign', 'false');
	await writeFile(join(root, 'README.md'), 'Disposable native acceptance fixture.\n');
	git(root, 'add', 'README.md');
	git(root, 'commit', '-m', 'chore: seed native acceptance');
	return git(root, 'rev-parse', 'HEAD');
}
