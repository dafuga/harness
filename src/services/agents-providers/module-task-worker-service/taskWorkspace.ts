// @harness-uid u_7azx2rtrnn
import type {
	ModuleTask,
	TaskSelection
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { ModuleTaskWorktreeAdapter } from '../../../adapters/agents-providers/ModuleTaskWorktreeAdapter';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { symlink } from 'node:fs/promises';
import { pendingTaskResult, taskWrites } from './taskClaim';
export async function taskWorkspace(root: string, task: ModuleTask, selection: TaskSelection) {
	const worktree = resolve(root, '.cache/harness/task-worktrees', task.claim!.token);
	return {
		...pendingTaskResult(selection, worktree),
		attempt: task.claim!.token,
		sourceCommit: task.repairCommit ?? task.sourceCommit
	};
}

/** Share installed dependencies without moving worker output into the common checkout. */
export async function prepareTaskWorkspace(root: string, worktree: string): Promise<void> {
	const source = join(root, 'node_modules'),
		target = join(worktree, 'node_modules');
	if (existsSync(source) && !existsSync(target)) await symlink(source, target, 'dir');
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
