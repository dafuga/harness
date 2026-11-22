// @harness-uid u_b4uzqkb2i6
import { randomUUID } from 'node:crypto';
import type { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import type { TaskClaimOptions } from './taskClaim.types';
import { TaskWorktreeChangedError } from '../../../adapters/agents-providers/TaskWorktreeChangedError';
import type {
	ModuleTask,
	ModuleTaskQueue,
	TaskSelection
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
export function pendingTaskResult(
	selection: TaskSelection,
	worktree: string
): NonNullable<ModuleTask['result']> {
	return {
		...selection,
		reportedModel: null,
		text: '',
		worktree,
		changedFiles: [],
		fallback: false,
		executions: [],
		finishedAt: new Date().toISOString()
	};
}
/** A queued task this worker may pick up, before machine preflight. */
export function claimable(task: ModuleTask, worker: string, modules: string[]): boolean {
	return (
		task.status === 'queued' &&
		(!task.assignee || task.assignee === worker) &&
		(!modules.length || modules.includes(task.module.id))
	);
}
export function claimedTask(
	queue: ModuleTaskQueue,
	worker: string,
	modules: string[],
	{ owner, blocked = new Set() }: TaskClaimOptions
) {
	const busy = new Set(queue.tasks.filter((t) => t.status === 'running').map((t) => t.module.id));
	const task = queue.tasks.find(
		(t) => claimable(t, worker, modules) && !busy.has(t.module.id) && !blocked.has(t.id)
	);
	if (!task) return null;
	task.status = 'running';
	task.claim = { worker, token: randomUUID(), startedAt: new Date().toISOString(), owner };
	return task;
}
export function finishTask(
	queue: ModuleTaskQueue,
	claimed: ModuleTask,
	result: ModuleTask['result']
) {
	const current = queue.tasks.find((t) => t.id === claimed.id);
	if (
		!current ||
		![
			current.status === 'running',
			current.claim?.token === claimed.claim?.token,
			current.contractHash === claimed.contractHash,
			current.sourceCommit === claimed.sourceCommit,
			current.repairCommit === claimed.repairCommit
		].every(Boolean)
	)
		throw new Error('Task definition or claim changed; result was not overwritten.');
	current.status = result?.error ? 'failed' : 'review';
	current.result = result;
}
export async function taskWrites(git: GitAdapter, task: ModuleTask): Promise<string[]> {
	if ((await git.run(['rev-parse', 'HEAD'])) !== task.sourceCommit)
		throw new TaskWorktreeChangedError(
			'Worker changed its source commit; review the preserved worktree.'
		);
	const tracked = await git.run(['diff', '--name-only', '-z', 'HEAD']),
		untracked = await git.run(['ls-files', '--others', '--exclude-standard', '-z']);
	const paths = [...new Set((tracked + '\0' + untracked).split('\0').filter(Boolean))];
	const outside = paths.filter((path) => !task.module.files.includes(path));
	if (outside.length)
		throw new TaskWorktreeChangedError(
			`Worker wrote outside the assigned module: ${outside.join(', ')}. Worktree preserved.`
		);
	return paths;
}
