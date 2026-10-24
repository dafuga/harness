import type { TaskCheckpointInput } from './ModuleTaskWorktreeAdapter.types';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { GitAdapter } from '../git-source-history/GitAdapter';
import { commitIdentity } from '../../utils/git-source-history/commitIdentity';
/** Commit reviewable source without moving its checkout or changing either Git index. */
export class ModuleTaskWorktreeAdapter {
	constructor(private readonly root: string) {}
	async checkpoint(input: TaskCheckpointInput): Promise<string> {
		const git = new GitAdapter(input.cwd),
			owner = new GitAdapter(this.root);
		const common = await realpath(
			resolve(input.cwd, await git.run(['rev-parse', '--git-common-dir']))
		);
		const expected = await realpath(
			resolve(this.root, await owner.run(['rev-parse', '--git-common-dir']))
		);
		if (common !== expected || (await git.run(['rev-parse', 'HEAD'])) !== input.source)
			throw new Error('Task worktree source or repository changed.');
		if (!input.paths.length) return input.source;
		const scratch = await mkdtemp(join(tmpdir(), 'harness-task-index-'));
		const env = { GIT_INDEX_FILE: join(scratch, 'index') };
		try {
			await git.run(['read-tree', input.source], { env });
			await git.run(['--literal-pathspecs', 'add', '-A', '--', ...input.paths], { env });
			const tree = await git.run(['write-tree'], { env });
			return await git.run(
				['commit-tree', tree, '-p', input.source, '-m', 'chore: preserve module task submission'],
				{ env: await commitIdentity(git) }
			);
		} finally {
			await rm(scratch, { recursive: true, force: true });
		}
	}
}
