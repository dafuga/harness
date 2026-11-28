// @harness-uid u_7azx2rtrnn
import type {
	ModuleTask,
	TaskSelection
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { ModuleTaskWorktreeAdapter } from '../../../adapters/agents-providers/ModuleTaskWorktreeAdapter';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, readdir, symlink } from 'node:fs/promises';
import { pendingTaskResult, taskWrites } from './taskClaim';
import { FrameFlagService } from '../../verification-evidence/FrameFlagService';
import { completeModule, moduleCompletionContext } from '../completion-hooks/moduleCompletion';
import type { ModuleCompletionContext } from '../completion-hooks/moduleCompletion.types';
export async function taskWorkspace(root: string, task: ModuleTask, selection: TaskSelection) {
	const common = await new GitAdapter(root).run(['rev-parse', '--git-common-dir']);
	const worktree = resolve(root, common, '..', '.cache/harness/task-worktrees', task.claim!.token);
	return {
		...pendingTaskResult(selection, worktree),
		attempt: task.claim!.token,
		sourceCommit: task.repairCommit ?? task.sourceCommit
	};
}

/**
 * Share installed packages but keep the folder itself in the worktree, so tool caches written
 * under node_modules stay with this attempt and inside a provider sandbox's writable area.
 */
export async function prepareTaskWorkspace(root: string, worktree: string): Promise<void> {
	const source = join(root, 'node_modules'),
		target = join(worktree, 'node_modules');
	if (!existsSync(source) || existsSync(target)) return;
	await mkdir(target);
	for (const entry of await readdir(source, { withFileTypes: true }))
		if (entry.isDirectory() || entry.isSymbolicLink())
			await symlink(join(source, entry.name), join(target, entry.name), 'dir');
}

/** Pending frame feedback follows ownership into each isolated attempt. */
export async function taskFrameInputs(
	root: string,
	task: ModuleTask,
	worktree: string,
	prompt: string
) {
	const feedback = await new FrameFlagService(root).feedback(
		task.module.id,
		join(worktree, '.cache/harness/frame-inputs')
	);
	return {
		images: feedback.images,
		prompt: feedback.text
			? prompt +
				'\n\nReview every flagged frame. Address each pending flag in the replacement recording.\n' +
				feedback.text
			: prompt
	};
}
export async function snapshotTaskWork(
	root: string,
	task: ModuleTask,
	result: NonNullable<ModuleTask['result']> & {
		[moduleCompletionContext]?: ModuleCompletionContext;
	}
) {
	const context = result[moduleCompletionContext];
	delete result[moduleCompletionContext];
	try {
		if (context)
			await completeModule({
				owner: new GitAdapter(root),
				task,
				result,
				context,
				prepare: (worktree) => prepareTaskWorkspace(root, worktree)
			});
	} finally {
		await preserveTaskWork(root, task, result);
	}
}

async function preserveTaskWork(
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
