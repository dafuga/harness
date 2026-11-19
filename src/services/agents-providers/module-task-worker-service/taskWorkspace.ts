// @harness-uid u_7azx2rtrnn
import type {
	ModuleTask,
	TaskSelection
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { ModuleTaskWorktreeAdapter } from '../../../adapters/agents-providers/ModuleTaskWorktreeAdapter';
import { resolve } from 'node:path';
import { pendingTaskResult, taskWrites } from './taskClaim';
export async function taskWorkspace(root: string, task: ModuleTask, selection: TaskSelection) {
	const common = await new GitAdapter(root).run(['rev-parse', '--git-common-dir']);
	const worktree = resolve(root, common, '..', '.cache/harness/task-worktrees', task.claim!.token);
	return {
		...pendingTaskResult(selection, worktree),
		attempt: task.claim!.token,
		sourceCommit: task.repairCommit ?? task.sourceCommit
	};
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
	result.changedLines = await checkpointChangedLines(
		new GitAdapter(root),
		source,
		result.checkpointCommit
	);
}

async function checkpointChangedLines(git: GitAdapter, source: string, checkpoint: string) {
	const stats = await git
		.attempt([
			'diff',
			'--numstat',
			'-z',
			'--no-renames',
			'--no-ext-diff',
			'--no-textconv',
			source,
			checkpoint
		])
		.catch(() => undefined);
	if (stats === undefined) return undefined;
	let lines = 0;
	for (const row of stats.split('\0').filter(Boolean)) {
		const [added, removed] = row.split('\t', 2);
		if (!/^\d+$/.test(added) || !/^\d+$/.test(removed)) return undefined;
		lines += Number(added) + Number(removed);
	}
	return lines;
}
