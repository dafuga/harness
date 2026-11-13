import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TemporaryRepo } from './temporary.types';

export async function withTempDir<T>(
	prefix: string,
	use: (directory: string) => Promise<T> | T
): Promise<T> {
	const directory = await mkdtemp(join(tmpdir(), prefix));
	try {
		return await use(directory);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

export async function withTempRepo<T>(
	use: (repository: TemporaryRepo) => Promise<T> | T,
	prefix = 'harness-repo-'
): Promise<T> {
	return withTempDir(prefix, async (root) => {
		const git = (...args: string[]) =>
			execFileSync('git', args, {
				cwd: root,
				encoding: 'utf8',
				env: {
					...process.env,
					GIT_AUTHOR_NAME: 'Harness Fixture',
					GIT_AUTHOR_EMAIL: 'harness-fixture@example.invalid',
					GIT_COMMITTER_NAME: 'Harness Fixture',
					GIT_COMMITTER_EMAIL: 'harness-fixture@example.invalid'
				}
			}).trim();
		git('init', '-q', '-b', 'main');
		git('config', 'user.name', 'Harness Fixture');
		git('config', 'user.email', 'harness-fixture@example.invalid');
		return use({ root, git });
	});
}
