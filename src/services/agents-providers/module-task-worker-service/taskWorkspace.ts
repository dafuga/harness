import type {
	ModuleTask,
	TaskSelection
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { ModuleTaskWorktreeAdapter } from '../../../adapters/agents-providers/ModuleTaskWorktreeAdapter';
import { createHash } from 'node:crypto';
import { lstat, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pendingTaskResult, taskWrites } from './taskClaim';
export async function taskWorkspace(root: string, task: ModuleTask, selection: TaskSelection) {
	const token = task.claim?.token;
	if (!token || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(token))
		throw new Error('A valid task claim is required for worktree placement.');
	const project = await realpath(root);
	const commonPath = (await new GitAdapter(root).run(['rev-parse', '--git-common-dir'])).trim();
	if (!commonPath) throw new Error('The common Git directory is unavailable.');
	const common = await realpath(resolve(project, commonPath));
	const identity = createHash('sha256').update(common).digest('hex');
	const worktree = resolve(
		dirname(dirname(common)),
		'.cache/harness/task-worktrees',
		identity,
		token
	);
	if (overlaps(project, worktree) || overlaps(common, worktree))
		throw new Error('The task worktree must be isolated from the repository.');
	await verifyCachePath(worktree);
	return {
		...pendingTaskResult(selection, worktree),
		attempt: task.claim!.token,
		sourceCommit: task.repairCommit ?? task.sourceCommit
	};
}

function overlaps(left: string, right: string): boolean {
	const contains = (parent: string, child: string) => {
		const path = relative(parent, child);
		return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`));
	};
	return contains(left, right) || contains(right, left);
}
function isMissing(error: unknown): boolean {
	return !!error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
}
async function verifyCachePath(candidate: string): Promise<void> {
	let ancestor = candidate;
	while (true) {
		try {
			const info = await lstat(ancestor);
			if (info.isSymbolicLink() || !info.isDirectory() || (await realpath(ancestor)) !== ancestor)
				throw new Error('The task worktree cache cannot be resolved safely.');
			return;
		} catch (error) {
			if (!isMissing(error)) throw error;
			const parent = dirname(ancestor);
			if (parent === ancestor) throw new Error('The task worktree cache is unavailable.');
			ancestor = parent;
		}
	}
}

export async function snapshotTaskWork(
	root: string,
	task: ModuleTask,
	result: NonNullable<ModuleTask['result']>
) {
	const source = result.sourceCommit ?? task.sourceCommit;
	result.changedFiles = await taskWrites(new GitAdapter(result.worktree), {
		...task,
		sourceCommit: source
	});
	result.checkpointCommit = await new ModuleTaskWorktreeAdapter(root).checkpoint({
		cwd: result.worktree,
		source,
		paths: result.changedFiles
	});
}
