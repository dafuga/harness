import { randomUUID } from 'node:crypto';
import type { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import type {
	ModuleTask,
	ModuleTaskQueue
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
export function claimedTask(queue: ModuleTaskQueue, worker: string, modules: string[]) {
	const busy = new Set(queue.tasks.filter((t) => t.status === 'running').map((t) => t.module.id));
	const task = queue.tasks.find(
		(t) =>
			t.status === 'queued' &&
			(!t.assignee || t.assignee === worker) &&
			(!modules.length || modules.includes(t.module.id)) &&
			!busy.has(t.module.id)
	);
	if (!task) return null;
	task.status = 'running';
	task.claim = { worker, token: randomUUID(), startedAt: new Date().toISOString() };
	return task;
}
export function finishTask(
	queue: ModuleTaskQueue,
	claimed: ModuleTask,
	result: ModuleTask['result']
) {
	const current = queue.tasks.find((t) => t.id === claimed.id);
	if (!current || current.status !== 'running' || current.claim?.token !== claimed.claim?.token)
		throw new Error('Task claim changed; result was not overwritten.');
	current.status = result?.error ? 'failed' : 'review';
	current.result = result;
}
export async function taskWrites(git: GitAdapter, task: ModuleTask): Promise<string[]> {
	if ((await git.run(['rev-parse', 'HEAD'])) !== task.sourceCommit)
		throw new Error('Worker changed its source commit; review the preserved worktree.');
	const tracked = await git.run(['diff', '--name-only', '-z', 'HEAD']),
		untracked = await git.run(['ls-files', '--others', '--exclude-standard', '-z']);
	const paths = [...new Set((tracked + '\0' + untracked).split('\0').filter(Boolean))];
	const outside = paths.filter((path) => !task.module.files.includes(path));
	if (outside.length)
		throw new Error(
			`Worker wrote outside the assigned module: ${outside.join(', ')}. Worktree preserved.`
		);
	return paths;
}
